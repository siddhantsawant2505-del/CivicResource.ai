const BASE = "http://localhost:5000/api";

const login = async () => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@civicflow.ai", password: "admin123" }),
  });
  return res.json();
};

const expectedType = (incident) => {
  const incidentType = String(incident?.type || "").toLowerCase();
  const text = `${incident?.type || ""} ${incident?.title || ""} ${incident?.details || ""}`.toLowerCase();
  if (incidentType === "fire") return "fire";
  if (incidentType === "medical") return "medical";
  if (["crime", "safety", "traffic"].includes(incidentType)) return "police";
  if (incidentType === "sanitation" || /(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return "sanitation";
  return "utility";
};

const main = async () => {
  const auth = await login();
  if (!auth.token) {
    console.log("LOGIN FAILED:", auth);
    return;
  }
  const h = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };

  const incidents = await (await fetch(`${BASE}/incidents`, { headers: h })).json();
  const personnel = await (await fetch(`${BASE}/dispatch/personnel?all=true`, { headers: h })).json();

  const active = incidents.filter((i) => i.status !== "resolved");
  console.log(`\nincidents total=${incidents.length} active=${active.length}`);
  const incByType = {};
  for (const i of active) {
    const k = `${i.type} (dispatch=${i.dispatchStatus}) -> expects ${expectedType(i)}`;
    incByType[k] = (incByType[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(incByType)) console.log(`  ${v}  ${k}`);

  console.log(`\npersonnel total=${personnel.length}`);
  const perByType = {};
  for (const p of personnel) {
    const k = `${p.type} / ${p.status}`;
    perByType[k] = (perByType[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(perByType)) console.log(`  ${v}  ${k}`);

  const available = personnel.filter((p) => String(p.status).toLowerCase() === "available");
  console.log(`\navailable personnel: ${available.length}`);

  const target =
    active.find((i) => i.dispatchStatus === "unassigned") || active[0];
  if (!target) {
    console.log("No active incident to test.");
    return;
  }

  const want = expectedType(target);
  const match = available.find((p) => String(p.type).toLowerCase() === want);
  const mismatched = available.find((p) => String(p.type).toLowerCase() !== want);

  console.log(`\n--- Attempt 1: correct-type personnel ---`);
  console.log(`incident "${target.title}" type=${target.type} expects=${want}`);
  if (match) {
    const res = await fetch(`${BASE}/dispatch/assign`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ incidentId: target._id, personnelIds: [match._id] }),
    });
    const body = await res.json();
    console.log(`HTTP ${res.status} message="${body.message}"`);
    console.log(`results=${JSON.stringify(body.results)}`);
  } else {
    console.log(`NO available personnel of type "${want}"`);
  }

  const freshIncidents = await (await fetch(`${BASE}/incidents`, { headers: h })).json();
  const after = freshIncidents.find((i) => i._id === target._id);
  console.log(`incident dispatchStatus after = ${after?.dispatchStatus}`);

  console.log(`\n--- Attempt 2: mismatched-type personnel (should be rejected) ---`);
  if (mismatched) {
    const res = await fetch(`${BASE}/dispatch/assign`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ incidentId: target._id, personnelIds: [mismatched._id] }),
    });
    const body = await res.json();
    console.log(`HTTP ${res.status} message="${body.message}"`);
    console.log(`results=${JSON.stringify(body.results)}`);
  }
};

main().catch((e) => console.error("PROBE ERROR:", e));
