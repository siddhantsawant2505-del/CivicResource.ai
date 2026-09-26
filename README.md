# CivicResource.ai 🏛️🧠

**CivicResource.ai** is an AI-assisted civic operations platform that connects complaint intake, dispatch intelligence, and field execution in one operational flow.

---

## 🏛️ Core Innovation Pillars

### 1. The Intelligence Matrix (Analysis)
Combines multi-modal signals into actionable urban insights.

- **Dynamic Demand Forecasting**: Predicts zonal pressure using ensemble-learning.
- **Intelligent Complaint Triage**: NLP-driven validation of citizen reports in English, Hindi, and Marathi.
- **Hotspot Clustering**: Identifies geographic incident trends using DBSCAN.

### 2. The Governance Matrix (Compliance)
Ensures accountability through automated logic and audit trails.

- **SLA Efficiency Tracking**: Monitors response times against municipal mandates.
- **Strategic Allocation**: Haversine-optimized resource dispatch with "Need-Matching."
- **Protocol Integrity**: Auditable Protocol IDs for every urban incident.

---

## 🚀 System Architecture

```mermaid
graph TD
    subgraph "Citizen Induction"
        A[Mobile/Web Signal] --> B{AI Intake}
        B -- "English/Hindi/Marathi" --> C[NLP Normalization]
    end

    subgraph "Platform Architecture"
        C --> D[Intelligence Matrix]
        D --> E[Command Center HUD]
        E --> F[Governance Matrix]
        F --> G[Dispatch Relay]
        G --> H[Worker Journey HUD]
    end
```

---

## 🛣️ Major Capabilities

### 📋 Complaint Intake & Trust
- **Multilingual Intake**: Normalizes reports in English, Hindi, and Marathi.
- **Trust Scoring**: AI-assisted triage and civic relevance checks.
- **Duplicate Fusion**: Clustering repeated reports into a single actionable signal.

### 🧠 AI & Optimization
- **Demand Forecasting**: Zone urgency scoring and crisis mode templates (Flood, Festival, Strike, Heatwave).
- **Explainable Allocation**: Suggestions with scoring factors for transparent decision support.

### ⚡ Dispatch & Operations
- **Live Dispatch Panel**: Dynamic "Apply-Plan" flow with smart fallback recommendations.
- **Worker Journey Simulation**: Real-time tracking of route lifecycle (En-route, On-site, Resolved).
- **ETA Countdown**: Precise mm:ss updates synced across Worker and Admin maps.

---

## 🛠️ Tech Stack & Layout

### Technology Stack
- **Client**: React 18, Vite, Tailwind CSS, Framer Motion, React Leaflet.
- **Server**: Node.js, Express, MongoDB + Mongoose, JWT Auth.
- **AI Engine**: FastAPI, Scikit-Learn Ensemble, NLP (SpaCy).
- **Mobile**: Expo, React Native.

### Repository Layout
- **`client/`**: Web UI and operational dashboards.
- **`server/`**: API routes, business logic, and simulation scripts.
- **`ai-engine/`**: AI services, training scripts, and model assets.
- **`mobile-app/`**: Workflows for citizen and field usage.

---

## 🚀 Local Setup

### 0. Prerequisites
- **Node.js 18+** and **Python 3.10+**
- **MongoDB** running locally (or a MongoDB Atlas connection string)
  - With Docker: `docker compose up -d` (uses the included `docker-compose.yml`)
  - Or install MongoDB Community Server and start `mongod`

### 1. Configure Environment
- `server/.env` — set `MONGODB_URI`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `AI_ENGINE_URL`
- `client/.env` — set `VITE_API_BASE_URL` (defaults to `http://localhost:5000/api`)

### 2. Install Dependencies
- `server/`: `npm install`
- `client/`: `npm install`
- `ai-engine/`: `pip install -r requirements.txt`

### 3. Seed the Database
- From the repository root: `npm run seed` (same as `server/`: `npm run seed`)

### 4. Run Services

Start all three services with one command from the repository root:

```bash
npm run dev
```

They become available at:
- Backend API → http://localhost:5000
- Web client → http://localhost:8080
- AI engine → http://localhost:8000

Verify everything is reachable (MongoDB, API, AI engine, client):

```bash
npm run health
```

Or start each service manually in separate terminals:
- `server/`: `npm run dev` → http://localhost:5000
- `client/`: `npm run dev` → http://localhost:8080
- `ai-engine/`: `python main.py` → http://localhost:8000

---
## ✅ Latest Updates (Apr 2026)

### Dispatch Reliability & Allocation Quality
- **Type-Safe Dispatch Assignment**: Water/utility complaints can no longer be assigned to police responders.
- **Apply Button Hardening**: Manual **Apply** now selects the nearest compatible available worker instead of falling back to unrelated worker types.
- **Backend Guardrails**: `/api/dispatch/assign` now rejects personnel type mismatches with explicit `skipped_type_mismatch` results.
- **Status Integrity**: Incident `dispatchStatus` is now only marked `dispatched` when at least one valid dispatch actually occurs.

### Live Plan Behavior
- **Live Apply Plan Compatibility**: Maintains proximity-aware assignment while honoring responder-family compatibility for safer auto-allocation.
- **Operational Transparency**: Assignment results now clearly indicate when candidates were skipped due to mismatch.

### Multilingual UX Refinements
- **Native Language Labels** on public selectors:
    - Hindi shown as **हिंदी**
    - Marathi shown as **मराठी**
    - English shown as **English**
- Applied in both **Complaint Intake** and **Landing Page** language switchers.

---
*Built for Civic Excellence & Modern Urban Governance.*
