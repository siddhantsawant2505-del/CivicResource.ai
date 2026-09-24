# Teammate Guide: CivicResource.ai

This document is for internal onboarding so any teammate can quickly understand what the platform does, how it is organized, how data flows, and where to extend it.

## 1) What This Product Does

CivicResource.ai is an incident lifecycle platform for city operations.

It covers:

1. Citizen issue intake.
2. Admin triage and dispatch.
3. Worker execution and closure.
4. Monitoring and analytics.

Think of it as one operational graph from complaint creation to field resolution.

## 2) Who Uses It

### Citizens

1. File complaints from mobile app.
2. Track status by phone/tracking ID.
3. Get updates when status changes.

### Admin / Operator

1. See unassigned incidents.
2. Assign incidents to compatible worker types.
3. Monitor active and resolved work across the city.

### Workers / Responders

1. Receive assigned incidents.
2. Start work with initialize action.
3. Mark completion with resolve action.
4. View tactical map context in web HUD.

## 3) High-Level Architecture

### client (Web)

1. React + Vite app.
2. Admin dashboards and worker HUD.
3. Uses JWT from backend.

### server (Node API)

1. Auth, incidents, dispatch, resources, analytics.
2. MongoDB persistence.
3. Seeding scripts for demo-ready data.

### mobile-app (Expo / RN)

1. Citizen complaint and tracking flows.
2. Worker login + assignment visibility.
3. Offline queue and local notification behaviors.

### ai-engine (FastAPI)

1. Forecast and allocation analysis endpoints.
2. Consumed by web intelligence modules.

## 4) Data Model Essentials

### User

1. Identity, role, org.
2. Includes unit linkage for responder accounts.

### Personnel

1. Worker profile and type.
2. Unit ID, current location, current incident.

### Incident

1. Core fields: title, type, severity, status, dispatchStatus, location.
2. Assignment linkage through assignedPersonnel.
3. Public tracking fields for citizen-facing updates.

### Resource

1. Vehicle/equipment units and operational status.

## 5) Main Incident Lifecycle

1. Citizen creates incident.
2. Incident enters unassigned queue.
3. Admin dispatches to compatible worker type.
4. Incident moves to investigating/on-site/resolving.
5. Worker marks resolved.
6. Incident appears in archive/analytics views.

## 6) Assignment Logic (Important)

1. Dispatch enforces type compatibility to avoid wrong assignment.
2. Worker endpoints are account-scoped so a responder sees only relevant assignments.
3. Mobile worker flow now auto-loads from logged-in account; Unit ID is fallback only.

## 7) Tactical Worker Map (Web HUD)

Purpose:

1. Show exact incident coordinates.
2. Show responder unit position.
3. Render route polyline from unit to incident.
4. Show nearby risk markers for local context.

It is a field prioritization aid, not just a decorative chart.

## 8) Current Stack

### Frontend Web

1. React 18
2. TypeScript
3. Tailwind CSS
4. Framer Motion
5. React Leaflet

### Backend

1. Node.js
2. Express
3. MongoDB + Mongoose
4. JWT + bcrypt

### Mobile

1. Expo + React Native
2. AsyncStorage
3. NetInfo
4. Local notifications

### AI

1. FastAPI
2. Python ML services for forecast/allocation

## 9) How To Run Locally (Team Workflow)

1. Start backend in server.
2. Start AI engine in ai-engine.
3. Start web app in client.
4. Start mobile app in mobile-app when needed.
5. Seed database in server before demos.

Recommended demo preparation:

1. Seed fresh data.
2. Keep one admin browser session and one worker session.
3. Run through one complete incident lifecycle live.

## 10) Key Files for New Contributors

### Backend

1. server/src/controllers/dispatchController.js
2. server/src/controllers/incidentController.js
3. server/src/controllers/authController.js
4. server/src/scripts/seeder.js
5. server/src/models

### Web

1. client/src/pages/DispatchSystem.tsx
2. client/src/pages/DriverHUD.tsx
3. client/src/pages/CommandCenter.tsx
4. client/src/components/AppLayout.tsx

### Mobile

1. mobile-app/App.tsx
2. mobile-app/src/services
3. mobile-app/src/types/index.ts
4. mobile-app/src/i18n.ts

## 11) Known Operational Notes

1. Mobile requires emulator/device-accessible API URLs.
2. If stale UI appears in Expo, reload bundle after major state-flow changes.
3. Seed data is opinionated for demos and should be updated before productionization.

## 12) Future Reference Roadmap

### Near-Term

1. Real ETA based on route distance + traffic approximation.
2. WebSocket live updates instead of polling.
3. Better worker timeline and audit events.

### Mid-Term

1. Full role-policy authorization per endpoint.
2. Incident SLA engine with escalations.
3. Better geospatial clustering and risk scoring.

### Long-Term

1. Multi-city tenant mode.
2. IoT sensor ingestion.
3. Predictive maintenance on resources.

## 13) Demo Story You Can Reuse

1. Citizen reports a road safety issue.
2. Admin receives and dispatches matching responder.
3. Worker opens assignment and tactical map.
4. Worker progresses and resolves.
5. Admin sees closure and improved dashboard state.

This sequence is the clearest way to explain value in a hackathon or stakeholder demo.
