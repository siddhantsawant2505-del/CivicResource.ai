# CivicResource.ai - Complete Data Flow & User Guide

## 🎯 System Overview

Your system has **3 key actors**:
1. **Citizens** (Mobile App) → File complaints
2. **Admin/Operators** (Website) → Dispatch workers to incidents
3. **Workers/Responders** (Website + Mobile) → Handle incidents

---

## 📋 LOGIN CREDENTIALS

### Admin & Operator (Website)
```
Email: admin@civicflow.ai
Password: admin123
Role: admin
Navigate to: /app (CommandCenter)
```

```
Email: operator@civicflow.ai
Password: admin123
Role: operator
Navigate to: /app (CommandCenter)
```

### 10 Workers/Responders (Website + Mobile)
```
Worker 1 (Police Officer):
  Email: worker1@civicflow.ai
  Password: worker1
  Type: police
  Unit ID: POL-001

Worker 2 (Police Officer):
  Email: worker2@civicflow.ai
  Password: worker2
  Type: police
  Unit ID: POL-002

Worker 3 (Firefighter):
  Email: worker3@civicflow.ai
  Password: worker3
  Type: fire
  Unit ID: FIR-001

Worker 4 (Firefighter):
  Email: worker4@civicflow.ai
  Password: worker4
  Type: fire
  Unit ID: FIR-002

Worker 5 (Medical Officer):
  Email: worker5@civicflow.ai
  Password: worker5
  Type: medical
  Unit ID: MED-001

Worker 6 (Medical Officer):
  Email: worker6@civicflow.ai
  Password: worker6
  Type: medical
  Unit ID: MED-002

Worker 7 (Utility Technician):
  Email: worker7@civicflow.ai
  Password: worker7
  Type: utility
  Unit ID: UTL-001

Worker 8 (Utility Technician):
  Email: worker8@civicflow.ai
  Password: worker8
  Type: utility
  Unit ID: UTL-002

Worker 9 (Sanitation Supervisor):
  Email: worker9@civicflow.ai
  Password: worker9
  Type: sanitation
  Unit ID: SAN-001

Worker 10 (Water Supply Technician):
  Email: worker10@civicflow.ai
  Password: worker10
  Type: utility
  Unit ID: WAT-001
```

---

## 🔄 END-TO-END DATA FLOW

### STEP 1: Citizen Files Complaint (Mobile App)

**Citizen opens mobile app:**
1. Selects **"Citizen"** role
2. Fills in complaint form:
   - **Title**: "Traffic jam at Dadar"
   - **Details**: "Heavy congestion, cars blocking"
   - **Phone**: "+91-9876543210" (for tracking)
   - **Type**: Select from list (traffic, fire, medical, sanitation, etc.)
   - **Location**: App auto-captures via GPS
3. **Language**: Can select English, Hindi, or Marathi
   - AI engine normalizes text to English
   - Details stored in both original + English

**Backend Creates INCIDENT:**
```json
{
  "_id": "ObjectId",
  "title": "Traffic jam at Dadar",
  "type": "traffic",
  "severity": "medium",
  "status": "active",
  "dispatchStatus": "unassigned",
  "reporterPhone": "+91-9876543210",
  "trackingId": "TR-2024-001",
  "location": {
    "lat": 19.0174,
    "lng": 72.8479,
    "address": "Dadar TT Flyover, Mumbai"
  },
  "assignedPersonnel": null,
  "createdAt": "2024-04-04T10:00:00Z"
}
```

**Offline Handling:**
- If no internet: Complaint queued in phone storage
- When online: Auto-syncs to backend
- Citizen can track status via phone number + tracking ID

---

### STEP 2: Admin Views Dashboard & Unassigned Incidents

**Admin logs in:** `admin@civicflow.ai` / `admin123`

**Goes to: DispatchSystem (/app/dispatch-system)**

**Sees all unassigned incidents:**
- Only shows incidents with `dispatchStatus = "unassigned"`
- Sorted by severity (Critical → High → Medium → Low)
- Shows map view + list view

**Example Unassigned Incidents:**
```
1. Traffic choke at Dadar (Type: traffic, Severity: HIGH) ← Police needed
2. Electrical fire at Kurla Market (Type: fire, Severity: CRITICAL) ← Fire needed
3. Medical parking blocked (Type: medical, Severity: CRITICAL) ← Medical needed
4. Garbage overflow (Type: sanitation, Severity: HIGH) ← Sanitation needed
```

---

### STEP 3: Admin Dispatches Worker (Type-Matched)

**Admin clicks on "Traffic choke at Dadar" incident**

**System automatically filters workers by TYPE:**
- Incident type: `traffic`
- Matching worker types: `police`
- Shows: **POL-001, POL-002** (available police officers)

**Type Matching Rules:**
```
Traffic/Crime/Safety → Police officers (POL-001, POL-002)
Fire → Firefighters (FIR-001, FIR-002)
Medical → Medical officers (MED-001, MED-002)
Utility/Infrastructure/Water → Utility workers (UTL-001, UTL-002, WAT-001)
Sanitation → Sanitation workers (SAN-001)
```

**Admin clicks "Dispatch POL-001"**

**Backend Validation:**
1. Check: Is POL-001 available? → ✓ Yes
2. Check: Does traffic incident match police type? → ✓ Yes
3. Update INCIDENT:
   ```json
   {
     "assignedPersonnel": "POL-001_ObjectId",
     "dispatchStatus": "dispatched",
     "status": "investigating"
   }
   ```
4. Update PERSONNEL (POL-001):
   ```json
   {
     "status": "busy",
     "currentIncident": "incident_ObjectId"
   }
   ```

**If wrong type (e.g., trying to assign fire incident to police):**
- Backend returns error: `"Cannot assign police to fire incident"`
- Dispatch blocked

---

### STEP 4: Worker Sees Assignment (Website HUD)

**Worker 1 logs in:** `worker1@civicflow.ai` / `worker1`

**Navigates to: DriverHUD (/app/driver)**

**System fetches assigned incidents** via endpoint:
```
GET /api/dispatch/my-assignments
```

**HUD Shows:**
```
┌─────────────────────────────────────────┐
│  OPERATOR HUD - Worker 1 (POL-001)      │
├─────────────────────────────────────────┤
│                                         │
│  🔴 ACTIVE INCIDENT                     │
│  Traffic choke at Dadar                 │
│  Severity: HIGH | Status: Investigating │
│  Location: 19.0174, 72.8479             │
│  Assigned: 2 mins ago                   │
│                                         │
│  [Initialize Route] [Mark Resolved]     │
│                                         │
├─────────────────────────────────────────┤
│  📋 OTHER ASSIGNED INCIDENTS            │
│  1. Safety incident at Worli (unstarted)│
│                                         │
└─────────────────────────────────────────┘
```

**Key: Workers only see THEIR ASSIGNED incidents, not everyone's**

---

### STEP 5: Worker Updates Status

**Worker clicks [Initialize Route]**
- Status changes: `investigating`
- Shown to admin in real-time

**Worker arrives on site, handles situation**

**Worker clicks [Mark Resolved]**
- Status changes: `resolved`
- Incident removed from HUD
- Shows next assigned incident (if any)

---

### STEP 6: Worker Gets Assignment (Mobile App)

**Worker also uses Mobile App (same credentials)**

**Worker enters Unit ID:** `POL-001`

**Mobile App polls backend every 20 seconds:**
```
GET /api/dispatch/assignments/POL-001
```

**If new incident assigned:**
- Local notification pops up
- "New incident: Traffic choke at Dadar"
- Worker can view details + map
- Same status update buttons available

---

### STEP 7: Admin Tracks Progress (CommandCenter)

**Admin goes to: CommandCenter (/app)**

**Sees Dashboard:**
```
┌──────────────────────────────────────┐
│  COMMAND CENTER - Live Operations    │
├──────────────────────────────────────┤
│                                      │
│  📊 Stats:                           │
│  Active Incidents: 5                 │
│  Deployed Units: 8                   │
│  Response Time: 8.6 min              │
│  SLA Compliance: 93%                 │
│                                      │
│  🗺️  City Map (shows all incidents)  │
│  💬 Live Feed                        │
│  📈 Analytics                        │
│                                      │
└──────────────────────────────────────┘
```

**Can drill into any incident to see:**
- Who it's assigned to (POL-001)
- Current status (investigating)
- Timeline of updates
- Location on map

---

## 📊 SEEDED DATA (After `npm run seed`)

### Users (12 Total)
- **1** Admin user
- **1** Operator user
- **10** Worker/Responder users

### Personnel (10 Total)
```
Police:     POL-001, POL-002
Fire:       FIR-001, FIR-002
Medical:    MED-001, MED-002
Utility:    UTL-001, UTL-002, WAT-001
Sanitation: SAN-001
```

### Incidents (14 Total)
```
Type: traffic | Assigned to: POL-001 | Status: investigating
Type: safety | Assigned: unassigned
Type: fire | Assigned to: FIR-001 | Status: investigating
Type: fire | Assigned: unassigned

Type: medical | Assigned to: MED-001 | Status: investigating
Type: medical | Assigned: unassigned

Type: utility | Assigned to: UTL-001 | Status: investigating
Type: utility | Assigned: unassigned

Type: sanitation | Assigned to: SAN-001 | Status: investigating
Type: sanitation | Assigned: unassigned

Type: water | Assigned to: WAT-001 | Status: investigating
Type: water | Assigned: unassigned

Type: roads | Assigned: unassigned (2 incidents)
```

---

## 🔐 Data Privacy & Permissions

### What CITIZENS see:
- Their own complaint status
- Tracking ID to check status
- Update on worker assignment (optional notification)

### What WORKERS see:
- Only incidents assigned to THEM
- Location, type, severity
- Buttons to update status
- Contact info if needed

### What ADMIN sees:
- ALL incidents
- All workers and their status
- Live tracking of operations
- Can make dispatch decisions

### What OPERATORS see:
- Same as admin (full access)
- Usually city-wide coordination

---

## 🚀 How to Test the Complete Flow

### 1. Start All Services
```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend
cd client
npm run dev

# Terminal 3: AI Engine
cd ai-engine
python main.py
```

### 2. Test Citizen → Admin → Worker Flow

**Step A: Simulate Citizen Filing Complaint**
- Open mobile app emulator
- Select Citizen mode
- Fill details: Title, Details, Type (select "traffic")
- Hit submit → Goes to backend as unassigned incident

**Step B: Admin Dispatches**
- Open http://localhost:5173 in browser
- Login: `admin@civicflow.ai` / `admin123`
- Go to DispatchSystem
- Click on the traffic complaint
- See "POL-001, POL-002" available (type-matched)
- Click Dispatch POL-001
- Incident disappears from unassigned (now dispatched)

**Step C: Worker Sees Assignment**
- Open new browser tab in incognito
- Login: `worker1@civicflow.ai` / `worker1`
- Go to DriverHUD
- See traffic incident as "ACTIVE INCIDENT"
- Click "Initialize Route" → status changes
- Click "Mark Resolved" → clears HUD

**Step D: Admin Tracks**
- Go back to admin tab
- Go to CommandCenter
- See incident in "Resolved" section
- Analytics updated

---

## 🎯 Key Fixes Applied

### ✅ Problem 1: Workers Seeing All Incidents
**Old:** DriverHUD showed ALL incidents
**New:** Only shows incidents assigned to that worker via `/api/dispatch/my-assignments`

### ✅ Problem 2: No Type Validation
**Old:** Could assign Fire incident to Police officer
**New:** Backend validates: `incident.type` matches `personnel.type`
- Blocks wrong assignments
- Returns clear error message

### ✅ Problem 3: Poor Data Structure
**Old:** 5 generic workers, no job types
**New:** 10 specific workers with proper types:
- 2 Police Officers
- 2 Firefighters
- 2 Medical Officers
- 2 Utility Technicians
- 1 Sanitation Worker
- 1 Water Supply Worker

### ✅ Problem 4: No User-Worker Mapping
**Old:** Unclear which User corresponds to which Personnel
**New:** Clear naming convention:
- `worker1` user → `POL-001` personnel
- `worker3` user → `FIR-001` personnel
- And so on...

---

## 📝 Command Reference

### Seed Database
```bash
cd server
npm run seed
```
Creates: 2 admin users + 10 worker users + 10 personnel + 14 incidents

### Run Development
```bash
cd server && npm run dev     # Backend on :5000
cd client && npm run dev     # Frontend on :5173
cd ai-engine && python main.py  # AI on :8000
```

### Check Database
```bash
# In MongoDB Atlas or Compass
Database: civicresourceai_dev
Collections: users, personnel, incidents, resources, analytics
```

---

## 🔧 Architecture Summary

```
┌─────────────┐
│   Citizen   │ (Mobile)
│ Files Issue │
└──────┬──────┘
       │
       v
  ┌─────────────────┐
  │  INCIDENT       │
  │  (unassigned)   │
  └────────┬────────┘
           │
           v
  ┌──────────────────────┐
  │   ADMIN              │
  │   DispatchSystem     │
  │   (See unassigned)   │
  └────────┬─────────────┘
           │
           v (Type-match filter)
  ┌──────────────────────┐
  │   PERSONNEL FILTER   │
  │   Shows POL-001,     │
  │   POL-002 only       │
  └────────┬─────────────┘
           │
           v (Click Dispatch)
  ┌──────────────────────┐
  │   UPDATE INCIDENT    │
  │   + UPDATE PERSONNEL │
  │   (status = busy)    │
  └────────┬─────────────┘
           │
           v
  ┌──────────────────────┐
  │   WORKER             │
  │   DriverHUD          │
  │   Sees assignment    │
  │   (mobile/web)       │
  └────────┬─────────────┘
           │
           v
  ┌──────────────────────┐
  │   UPDATE STATUS      │
  │   Initialize Route / │
  │   Mark Resolved      │
  └────────┬─────────────┘
           │
           v
  ┌──────────────────────┐
  │   ADMIN              │
  │   CommandCenter      │
  │   Tracks progress    │
  └──────────────────────┘
```

---

## ✨ What You Can Now Do

1. ✅ **Run seeder** → Creates 10 proper workers by type
2. ✅ **Admin dispatches** → Only sees type-matched workers
3. ✅ **Workers see assignment** → Only their own incidents (not all)
4. ✅ **Type validation** → Prevents wrong assignments
5. ✅ **Mobile integration** → Workers can accept assignments on phone
6. ✅ **End-to-end tracking** → Admin sees progress in real-time

---

## 🎓 Next Steps (When Ready)

1. Add notification service → Workers get alerts on assignment
2. Add SMS notifications → Citizens get updates via SMS
3. Add real-time updates → WebSocket for live dashboard
4. Add SLA tracking → Auto-escalate old incidents
5. Add performance metrics → Worker efficiency ratings
6. Add incident analytics → Trends, patterns, predictions

