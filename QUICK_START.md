# Quick Start & Testing Guide

> **Prerequisites:** MongoDB must be running and `server/.env` must define `MONGODB_URI`
> (e.g. `mongodb://127.0.0.1:27017/civicresourceai_dev`). With Docker: `docker compose up -d`.

## 1️⃣ Reset & Seed Database

```bash
cd server
npm run seed
```

**Output should be:** ✅ Data Seeded Successfully

This creates:
- 1 admin + 1 operator + 10 workers (all users)
- 10 personnel (workers with unit IDs)
- 14 incidents (7 assigned, 7 unassigned)

---

> **One-command alternative:** from the repository root, `npm run dev` starts all three
> services (and `npm run health` checks that MongoDB, the API, the AI engine, and the client
> are all reachable). The manual steps below do the same thing in separate terminals.

## 2️⃣ Start All Services

```bash
# Terminal 1
cd server && npm run dev
# Expected: Server running on http://localhost:5000

# Terminal 2
cd client && npm run dev
# Expected: Frontend on http://localhost:8080

# Terminal 3
cd ai-engine && python main.py
# Expected: FastAPI running on http://localhost:8000
```

---

## 3️⃣ Test Complete Flow

### **A. Admin - Dispatch an Incident**

1. Open http://localhost:8080
2. Click "Login"
3. Enter:
   - Email: `admin@civicflow.ai`
   - Password: `admin123`
4. Should redirect to `/app` (CommandCenter)
5. Click **DispatchSystem** (left menu)
6. See list of unassigned incidents
7. Click on **"Traffic choke near Dadar TT flyover"** (top one)
8. Should show **POL-001, POL-002** (police only)
9. Click **"Dispatch to POL-001"**
10. Confirm → incident disappears from list ✅

### **What You Just Did:**
- Found unassigned incident (type: traffic)
- System filtered to police only (correct type)
- Assigned to worker POL-001

---

### **B. Worker - See Assignment**

1. Open new browser tab (or logout)
2. Login with:
   - Email: `worker1@civicflow.ai`
   - Password: `worker1`
3. Should redirect to `/app/driver` (DriverHUD)
4. **Should see the traffic incident you just assigned**
5. Shows: Title, Severity, Status, Location
6. Try buttons: 
   - Click **[Initialize Route]** → Status changes to "investigating"
   - Click **[Mark Resolved]** → Incident resolved, disappears ✅

### **What You Just Did:**
- Worker only sees THEIR assignment (not all incidents)
- Worker can update status
- Only incidents assigned to this worker show

---

## 4️⃣ Test Type-Matching Validation

### **Try to assign WRONG type (should fail):**

1. As admin, go to DispatchSystem
2. Click on **"Minor fire in market electrical panel"** (type: fire)
3. System should show **FIR-001, FIR-002 only** (fire workers)
4. Try clicking "Dispatch to POL-001" (police)
   - **Should get error:** "Cannot assign police to fire incident"
   - Dispatch blocked ✅

### **What You Just Did:**
- Verified type validation works
- Backend prevents wrong assignments

---

## 5️⃣ Test Multiple Workers

### **Login as different workers:**

```
worker1@civicflow.ai / worker1    → POL-001 (Police)
worker3@civicflow.ai / worker3    → FIR-001 (Fire)
worker5@civicflow.ai / worker5    → MED-001 (Medical)
worker7@civicflow.ai / worker7    → UTL-001 (Utility)
worker9@civicflow.ai / worker9    → SAN-001 (Sanitation)
```

**Each should see ONLY incidents assigned to them**

---

## 6️⃣ Test Mobile App (iOS/Android)

### **Emulator Setup:**

1. Start Android emulator / iOS simulator
2. In mobile app:
   - Enter API URL: `http://10.0.2.2:5000/api` (Android)
   - Or: `http://localhost:5000/api` (iOS)
   - Enter AI URL: `http://10.0.2.2:8000` (Android)

### **Test Worker Mode:**

1. Select **Worker** role
2. Enter email: `worker1@civicflow.ai`
3. Enter password: `worker1`
4. Enter Unit ID: `POL-001`
5. App should start polling assignments
6. See traffic incident assigned to you
7. Can update status and add notes

### **Test Citizen Mode:**

1. Select **Citizen** role
2. File complaint:
   - Title: "Test Pothole"
   - Details: "Big hole in road at Dadar"
   - Phone: "+91-9876543210"
   - Type: roads
3. Toggle offline mode → complaint queued
4. Toggle online → should sync
5. Try to track with phone + tracking ID

---

## 7️⃣ Verify Data in Database

### **MongoDB Check (via Compass or Atlas):**

```
Use Database: civicresourceai_dev
```

**Users collection:**
```javascript
db.users.find().pretty()
// Should show 12 documents: 1 admin + 1 operator + 10 workers
```

**Personnel collection:**
```javascript
db.personnel.find().pretty()
// Should show 10 documents with unit IDs: POL-001, FIR-001, etc.
```

**Incidents collection:**
```javascript
db.incidents.find({ dispatchStatus: "dispatched" }).pretty()
// Should show incidents assigned to workers
```

**Check a specific incident:**
```javascript
db.incidents.findOne({ type: "traffic" })
// Should have:
// - assignedPersonnel: ObjectId reference
// - dispatchStatus: "dispatched"
// - status: "investigating"
```

---

## 🐛 Troubleshooting

### **"Cannot find personnel" error**
- Make sure you ran `npm run seed` first
- Check MongoDB connection in `.env`

### **Type validation not working**
- Restart backend: `npm run dev` in server folder
- Check dispatch controller has type mapping

### **Worker sees all incidents**
- Restart server
- Check endpoint `/api/dispatch/my-assignments` is implemented
- Verify auth middleware protecting the route

### **Seeder fails**
```bash
# Check if MongoDB is running
# Check .env has correct MONGODB_URI pointing to civicresourceai_dev
# Try again:
npm run seed
```

### **Incident assignment stuck**
- Clear browser cache
- Refresh DriverHUD page
- Check backend logs for errors

---

## 📊 Expected Behavior After Setup

| Feature | What To Test | Expected Result |
|---------|-------------|-----------------|
| Seeding | Run `npm run seed` | ✅ Data Seeded Successfully |
| Admin Login | Login as admin | ✅ Redirects to CommandCenter (`/app`) |
| Worker Login | Login as worker1 | ✅ Redirects to DriverHUD (`/app/driver`) |
| Dispatch | Click "Dispatch" on incident | ✅ Shows only type-matched workers |
| Type Validation | Try wrong type dispatch | ❌ Error: "Cannot assign..." |
| Worker View | As worker, open DriverHUD | ✅ See only own assignments |
| Multi-Worker | Login as worker5 | ✅ Sees different incidents than worker1 |
| Mobile Auth | Login on mobile | ✅ Can enter Unit ID and see assignments |
| Offline Queue | Mobile in offline, file complaint | ✅ Queues complaint, syncs when online |

---

## ✅ Success Checklist

- [ ] Seeder runs without errors
- [ ] Admin can see unassigned incidents
- [ ] Admin can dispatch to correct worker type
- [ ] Type validation prevents wrong dispatch
- [ ] Worker1 sees only their assigned incidents (not all)
- [ ] Worker5 sees different incidents than Worker1
- [ ] Worker can update incident status
- [ ] Mobile app can login as worker
- [ ] Mobile app shows assignments matching Unit ID
- [ ] Citizen can file complaint on mobile
- [ ] Admin DispatchSystem filters by incident type ✅

**If all checked, you're ready to deploy! 🚀**

