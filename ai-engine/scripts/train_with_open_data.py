import hashlib
import os
import sys
from datetime import UTC, datetime

import numpy as np
import pandas as pd
import requests

ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)

from main import train_complaint_triage_models, train_models_from_historical_dataset

DATA_DIR = os.path.join(ROOT_DIR, "data")
TRIAGE_PATH = os.path.join(DATA_DIR, "complaint_triage.csv")
DEMAND_PATH = os.path.join(DATA_DIR, "historical_demand.csv")

NYC_311_ENDPOINT = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"


def stable_noise(*parts: str, scale: float = 1.0) -> float:
    key = "|".join(str(p) for p in parts)
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    value = int(digest[:8], 16) / 0xFFFFFFFF
    return value * scale


def map_intent(complaint_type: str, descriptor: str) -> str:
    text = f"{complaint_type or ''} {descriptor or ''}".lower()

    if any(k in text for k in ["water", "hydrant", "sewer", "drain", "flood", "leak"]):
        return "water"
    if any(k in text for k in ["garbage", "trash", "waste", "sanitation", "litter", "recycling", "rodent"]):
        return "garbage"
    if any(k in text for k in ["pothole", "street", "road", "highway", "sidewalk", "curb"]):
        return "roads"
    if any(k in text for k in ["electric", "street light", "streetlight", "power", "utility", "signal"]):
        return "utility"
    if any(k in text for k in ["noise", "crime", "fire", "hazard", "unsafe", "danger", "illegal parking"]):
        return "safety"
    if any(k in text for k in ["traffic", "congestion", "double parked", "blocked driveway"]):
        return "traffic"
    if any(k in text for k in ["repair", "maintenance", "broken", "damaged", "construction"]):
        return "maintenance"
    return "general"


def fetch_nyc_311(max_rows: int = 50000) -> pd.DataFrame:
    fields = [
        "created_date",
        "closed_date",
        "complaint_type",
        "descriptor",
        "incident_address",
        "borough",
        "latitude",
        "longitude",
        "status",
    ]

    all_rows = []
    offset = 0
    batch = 50000

    while offset < max_rows:
        limit = min(batch, max_rows - offset)
        params = {
            "$select": ",".join(fields),
            "$where": "created_date >= '2024-01-01T00:00:00' AND complaint_type IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL",
            "$limit": limit,
            "$offset": offset,
            "$order": "created_date ASC",
        }
        response = requests.get(NYC_311_ENDPOINT, params=params, timeout=45)
        response.raise_for_status()
        rows = response.json()
        if not rows:
            break

        all_rows.extend(rows)
        offset += len(rows)

        if len(rows) < limit:
            break

    if not all_rows:
        raise RuntimeError("No NYC 311 rows fetched")

    df = pd.DataFrame(all_rows)
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df["created_date"] = pd.to_datetime(df["created_date"], errors="coerce", utc=True)
    df["closed_date"] = pd.to_datetime(df.get("closed_date"), errors="coerce", utc=True)
    df = df.dropna(subset=["created_date", "latitude", "longitude", "complaint_type"]).copy()

    return df


def build_triage_dataset(nyc_df: pd.DataFrame) -> pd.DataFrame:
    triage = pd.DataFrame()
    triage["intent"] = nyc_df.apply(lambda r: map_intent(r.get("complaint_type", ""), r.get("descriptor", "")), axis=1)
    triage["text"] = (
        nyc_df["complaint_type"].fillna("")
        + " | "
        + nyc_df["descriptor"].fillna("")
        + " | "
        + nyc_df["incident_address"].fillna("")
        + " | "
        + nyc_df["borough"].fillna("")
    ).str.strip()
    triage["is_fake"] = 0
    triage = triage[triage["text"].str.len() > 15]

    # Balance classes to prevent the model from collapsing to the dominant "general" class.
    capped = []
    for intent, group in triage.groupby("intent"):
        limit = 1200 if intent == "general" else 2000
        capped.append(group.sample(min(len(group), limit), random_state=42))
    triage = pd.concat(capped, ignore_index=True)

    existing = pd.read_csv(TRIAGE_PATH)
    existing = existing[["text", "intent", "is_fake"]]
    existing["intent"] = existing["intent"].fillna("general").astype(str).str.lower()
    existing["is_fake"] = pd.to_numeric(existing["is_fake"], errors="coerce").fillna(0).astype(int)

    # Keep high-value rows from previous data without letting noisy general rows dominate.
    existing_non_general = existing[existing["intent"] != "general"].groupby("intent", group_keys=False).apply(
        lambda x: x.sample(min(len(x), 900), random_state=42)
    )
    existing_general_fake = existing[(existing["intent"] == "general") & (existing["is_fake"] == 1)]
    existing_general_real = existing[(existing["intent"] == "general") & (existing["is_fake"] == 0)].sample(
        n=min(500, len(existing[(existing["intent"] == "general") & (existing["is_fake"] == 0)])),
        random_state=42,
    )
    existing_curated = pd.concat([existing_non_general, existing_general_fake, existing_general_real], ignore_index=True)

    # Keep all existing fake examples and add synthetic hard negatives for robustness.
    fake_templates = [
        "test message please ignore",
        "asdf qwerty random text",
        "hello world spam report",
        "dummy complaint for checking system",
        "free gift click here",
    ]
    synthetic_fake = pd.DataFrame(
        {
            "text": [f"{t} {i}" for i in range(1400) for t in fake_templates[:1]],
            "intent": ["general"] * 1400,
            "is_fake": [1] * 1400,
        }
    )

    merged = pd.concat([existing_curated, triage, synthetic_fake], ignore_index=True)
    merged["is_fake"] = pd.to_numeric(merged["is_fake"], errors="coerce").fillna(0).astype(int)
    merged["intent"] = merged["intent"].fillna("general").astype(str).str.lower()
    merged["text"] = merged["text"].fillna("").astype(str)
    merged = merged[merged["text"].str.len() > 8]
    merged = merged.drop_duplicates(subset=["text", "intent", "is_fake"]).reset_index(drop=True)

    return merged


def build_demand_dataset(nyc_df: pd.DataFrame) -> pd.DataFrame:
    df = nyc_df.copy()
    df["zone_lat"] = df["latitude"].round(1)
    df["zone_lng"] = df["longitude"].round(1)
    df["date"] = df["created_date"].dt.tz_convert("UTC").dt.floor("D")

    daily = (
        df.groupby(["zone_lat", "zone_lng", "date"], as_index=False)
        .agg(
            complaints_today=("complaint_type", "count"),
            unique_types=("complaint_type", "nunique"),
            unresolved_ratio=("status", lambda s: float((s.fillna("").str.lower() != "closed").mean())),
        )
        .sort_values(["zone_lat", "zone_lng", "date"])
    )

    daily["complaints_last_7d"] = (
        daily.groupby(["zone_lat", "zone_lng"])["complaints_today"]
        .rolling(7, min_periods=1)
        .sum()
        .reset_index(level=[0, 1], drop=True)
    )
    daily["historical_daily_avg"] = (
        daily.groupby(["zone_lat", "zone_lng"])["complaints_today"]
        .rolling(30, min_periods=3)
        .mean()
        .reset_index(level=[0, 1], drop=True)
    ).fillna(daily["complaints_today"])

    month_temp = {1: 24.5, 2: 26.0, 3: 29.5, 4: 32.5, 5: 33.5, 6: 30.5, 7: 28.5, 8: 28.0, 9: 28.0, 10: 29.0, 11: 27.0, 12: 25.0}
    month_rain = {1: 1.0, 2: 1.0, 3: 1.5, 4: 3.0, 5: 8.0, 6: 18.0, 7: 23.0, 8: 21.0, 9: 15.0, 10: 7.0, 11: 2.0, 12: 1.0}

    daily["month"] = daily["date"].dt.month
    daily["dow"] = daily["date"].dt.dayofweek

    daily["weather_temp_c"] = daily.apply(
        lambda r: month_temp[int(r["month"])] + stable_noise(str(r["zone_lat"]), str(r["zone_lng"]), str(r["date"]), scale=4.0),
        axis=1,
    )
    daily["weather_rain_mm"] = daily.apply(
        lambda r: max(0.0, month_rain[int(r["month"])] + stable_noise("rain", str(r["zone_lat"]), str(r["zone_lng"]), str(r["date"]), scale=6.0) - 2.5),
        axis=1,
    )

    # Normalize to a civic-command-center scale instead of raw citywide 311 volume.
    daily["complaints_today"] = np.clip(np.log1p(daily["complaints_today"]) * 6.0, 1.0, 35.0)
    daily["complaints_last_7d"] = np.clip(np.log1p(daily["complaints_last_7d"]) * 9.0, 1.0, 60.0)
    daily["historical_daily_avg"] = np.clip(np.log1p(daily["historical_daily_avg"]) * 8.0, 1.0, 55.0)

    daily["event_factor"] = np.where(daily["dow"].isin([5, 6]), 1.2, 1.0)
    daily.loc[daily["complaints_today"] >= daily["complaints_today"].quantile(0.9), "event_factor"] += 0.1

    zone_stats = (
        daily.groupby(["zone_lat", "zone_lng"], as_index=False)
        .agg(zone_volume=("complaints_today", "sum"), zone_type_diversity=("unique_types", "mean"))
    )
    daily = daily.merge(zone_stats, on=["zone_lat", "zone_lng"], how="left")

    daily["population_density"] = (
        3500
        + np.log1p(daily["zone_volume"]) * 900
        + daily["zone_type_diversity"] * 420
        + daily.apply(lambda r: stable_noise("pop", str(r["zone_lat"]), str(r["zone_lng"]), scale=3200), axis=1)
    )

    daily["demand_score"] = (
        daily["complaints_today"] * 1.3
        + daily["complaints_last_7d"] * 0.55
        + daily["event_factor"] * 4.5
        + daily["weather_rain_mm"] * 0.12
        + np.maximum(0.0, daily["weather_temp_c"] - 33.0) * 0.18
        + daily["unresolved_ratio"] * 2.5
    )

    out = pd.DataFrame(
        {
            "population_density": daily["population_density"].round(0),
            "complaints_last_7d": daily["complaints_last_7d"].round(1),
            "weather_rain_mm": daily["weather_rain_mm"].round(1),
            "weather_temp_c": daily["weather_temp_c"].round(1),
            "event_factor": daily["event_factor"].round(2),
            "historical_daily_avg": daily["historical_daily_avg"].round(1),
            "demand_score": daily["demand_score"].round(1),
        }
    )

    out = out.replace([np.inf, -np.inf], np.nan).dropna().reset_index(drop=True)

    existing = pd.read_csv(DEMAND_PATH)
    existing = existing[list(out.columns)]
    existing = existing[
        (existing["population_density"].between(1000, 50000))
        & (existing["complaints_last_7d"].between(0, 120))
        & (existing["weather_rain_mm"].between(0, 100))
        & (existing["weather_temp_c"].between(10, 50))
        & (existing["event_factor"].between(0.8, 3.0))
        & (existing["historical_daily_avg"].between(0, 120))
        & (existing["demand_score"].between(0, 250))
    ]
    merged = pd.concat([existing, out], ignore_index=True)
    merged = merged.drop_duplicates().reset_index(drop=True)

    return merged


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    print("Fetching NYC 311 open data...")
    nyc_df = fetch_nyc_311(max_rows=50000)
    print(f"Fetched {len(nyc_df)} rows")

    triage_df = build_triage_dataset(nyc_df)
    triage_df.to_csv(TRIAGE_PATH, index=False)
    print(f"Wrote triage dataset: {TRIAGE_PATH} ({len(triage_df)} rows)")

    demand_df = build_demand_dataset(nyc_df)
    demand_df.to_csv(DEMAND_PATH, index=False)
    print(f"Wrote demand dataset: {DEMAND_PATH} ({len(demand_df)} rows)")

    triage_meta = train_complaint_triage_models(TRIAGE_PATH)
    demand_meta = train_models_from_historical_dataset(DEMAND_PATH)

    print("Triage model trained:", triage_meta)
    print("Demand model trained:", demand_meta)
    print("Done at", datetime.now(UTC).isoformat())


if __name__ == "__main__":
    main()
