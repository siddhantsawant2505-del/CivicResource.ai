import pandas as pd
import numpy as np
import os
import random

# Configuration
DEMAND_FILE = os.path.join(os.path.dirname(__file__), "data", "historical_demand.csv")
TRIAGE_FILE = os.path.join(os.path.dirname(__file__), "data", "complaint_triage.csv")
NUM_ROWS = 1000

# --- Demand Data Generation ---

def generate_demand_data(n_rows):
    np.random.seed(42)
    pop_density = np.random.uniform(2000, 25000, n_rows)
    complaints_7d = np.random.poisson(lam=20, size=n_rows)
    weather_rain = np.random.exponential(scale=5, size=n_rows)
    weather_temp = np.random.normal(loc=30, scale=6, size=n_rows)
    event_factor = np.random.choice([1.0, 1.1, 1.25, 1.5, 1.8], size=n_rows, p=[0.7, 0.15, 0.08, 0.05, 0.02])
    hist_avg = np.random.uniform(5, 50, n_rows)
    
    noise = np.random.normal(0, 2, n_rows)
    demand_score = (
        0.00008 * pop_density +
        0.7 * complaints_7d +
        0.12 * weather_rain +
        0.2 * event_factor * hist_avg +
        np.maximum(0, (weather_temp - 30) * 0.1) +
        noise
    )
    demand_score = np.maximum(5.0, demand_score)
    
    return pd.DataFrame({
        "population_density": pop_density.astype(int),
        "complaints_last_7d": complaints_7d,
        "weather_rain_mm": np.round(weather_rain, 1),
        "weather_temp_c": np.round(weather_temp, 1),
        "event_factor": event_factor,
        "historical_daily_avg": np.round(hist_avg, 1),
        "demand_score": np.round(demand_score, 1)
    })

# --- Complaint Triage Data Generation ---

TEMPLATES = {
    "water": [
        "Water shortage in {area} for {n} days",
        "Pipeline leakage near {landmark} causing water waste",
        "Dirty water supply in {area}, please check",
        "No water tanker arrived today at {area}",
        "Low water pressure and dry taps for {n} hours",
        "Contaminated water from the main line in {area}"
    ],
    "garbage": [
        "Overflowing bins at {area} market",
        "Garbage not collected for {n} days in {area}",
        "Stinking waste pileup near {landmark}",
        "Illegal dumping behind the {building}",
        "Waste collection truck missed our ward {n}",
        "Dead animal carcass on the road in {area}"
    ],
    "roads": [
        "Deep pothole at {landmark} junction",
        "Damaged road surface near {area} station",
        "New road cracking after {n} weeks of usage",
        "Unpaved street in {area} causing dust issues",
        "Signal failure and road blockage at {landmark}",
        "Broken dividers on the main road at {area}"
    ],
    "utility": [
        "Power outage in {area} since {n} PM",
        "Transformer spark and fire risk near {landmark}",
        "Streetlight not working for the entire lane at {area}",
        "Overhanging electrical wires near {building}",
        "Utility line burst causing road flooding in {area}",
        "Gas pipeline repair needed at {area}"
    ],
    "maintenance": [
        "Open drain near the school at {area}",
        "Sewer blockage and overflow on {street}",
        "Broken manhole cover near {landmark}",
        "Public park fence damaged at {area}",
        "Maintenance needed for the bridge at {landmark}",
        "Clogged gutter causing street flooding"
    ],
    "safety": [
        "Empty property being used for illegal activities in {area}",
        "Streetlight dark zone making it unsafe near {landmark}",
        "Suspicious crowd gathered near {building}",
        "Emergency exit blocked in the complex at {area}",
        "No security patrol visible in {area} for weeks",
        "Fire hazard due to chemicals stored at {landmark}"
    ],
    "general": [
        "General civic issue report for {area}",
        "Requesting information about municipal taxes",
        "Feedback on the new park in {area}",
        "Public inquiry regarding site development at {landmark}"
    ]
}

AREAS = ["Sector 12", "Market Road", "Green Park", "Industrial Area", "Lakeview", "City Center", "Railway Colony"]
LANDMARKS = ["Central Station", "Grand Mall", "High School", "Public Hospital", "Police Chowki", "Main Junction"]
BUILDINGS = ["Galaxy Apartments", "Silver Towers", "Commercial Plaza", "Old Factory", "Community Hall"]

FAKE_TEXTS = [
    "test test test 123", "hello world", "dummy report please ignore", "spam buy now", 
    "asdf qwer zxcv", "lorem ipsum dolor sit amet", "testing the system", 
    "free gift click here", "ignore this", "sample data for triage"
]

def generate_triage_data(n_rows):
    data = []
    intents = list(TEMPLATES.keys())
    
    for _ in range(n_rows):
        is_fake = np.random.choice([0, 1], p=[0.85, 0.15])
        
        if is_fake:
            text = random.choice(FAKE_TEXTS)
            intent = "general"
        else:
            intent = random.choice(intents)
            template = random.choice(TEMPLATES[intent])
            text = template.format(
                area=random.choice(AREAS),
                landmark=random.choice(LANDMARKS),
                building=random.choice(BUILDINGS),
                street=f"Street {random.randint(1, 100)}",
                n=random.randint(1, 10)
            )
        
        data.append({"text": text, "intent": intent, "is_fake": int(is_fake)})
    
    return pd.DataFrame(data)

if __name__ == "__main__":
    os.makedirs(os.path.dirname(DEMAND_FILE), exist_ok=True)
    
    print(f"Generating {NUM_ROWS} rows of demand data...")
    demand_df = generate_demand_data(NUM_ROWS)
    demand_df.to_csv(DEMAND_FILE, index=False)
    print(f"Success! {DEMAND_FILE} updated.")
    
    print(f"Generating {NUM_ROWS} rows of triage data...")
    triage_df = generate_triage_data(NUM_ROWS)
    triage_df.to_csv(TRIAGE_FILE, index=False)
    print(f"Success! {TRIAGE_FILE} updated.")
