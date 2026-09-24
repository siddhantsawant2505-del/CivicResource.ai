# 🛡️ CivicResource Ai Backend: Data Persistence & Predictive Logic

The **CivicResource Ai Backend** is a high-performance **Node.js/Express** server that manages JWT-based identity, geospatial resource tracking, and urban analytics for the CivicResource Ai platform.

## 📦 Key Technologies

- **Node.js & Express**: Fast, unopinionated routing.
- **MongoDB & Mongoose**: Flexible, high-performance data modeling.
- **JWT (JSON Web Token)**: Stateless header-based session management.
- **Bcrypt**: Industrial-strength password hashing for secure authentication.

---

## 🏗️ Directory Structure

```plaintext
src/
├── config/           # Database Connection (db.js)
├── controllers/      # Route handler logic (authController, incidentController, resourceController, analyticsController)
├── middleware/       # JWT Auth protectors (authMiddleware.js)
├── models/           # Mongoose schemas (User, Incident, Resource, Analytics)
├── routes/           # Global endpoints (authRoutes, incidentRoutes, resourceRoutes, analyticsRoutes)
├── scripts/          # Seeder logic for populating operational data
├── services/         # Placeholder for external AI Service API integration
└── server.js         # Backend Entry Point
```

## 🔐 API Routing Highlights

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | User Registration | - |
| **POST** | `/api/auth/login` | Session Generation (Returns JWT) | - |
| **GET** | `/api/dashboard` | High-level Urban Analytics & Time-Series | ✅ |
| **GET** | `/api/incidents` | Real-time Incident List | ✅ |
| **POST** | `/api/incidents` | Create a new Incident (Citizen Reporting) | ✅ |
| **GET** | `/api/resources` | Active Resource Tracking | ✅ |

---

## 💾 Database Seeding

CivicResource Ai comes with a **Seeding Engine** to populate the environment with initial operational data. This ensures all maps and charts have data to display.

```bash
npm run seed
```
*Note: This command clears existing data in the `Users`, `Incidents`, `Resources`, and `Analytics` collections before repopulating a fresh simulated environment.*

---

## 🏁 Running Locally

```bash
npm install
npm run dev
```
The server will run on `http://localhost:5000`.

---

## 🏗️ Operational Logic

- **Incident Triage**: The server automatically calculates **SLA Compliance** based on created timestamps vs. current resource tracking.
- **Organization Scoping**: Data is automatically filtered based on the `organization` field in the user's JWT token (default: `Global`).
- **Geospatial Schema**: The `location` objects in `Incident` and `Resource` are optimized for Latitude/Longitude geospatial storage.
