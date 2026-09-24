# 🖥️ CivicResource Ai Frontend: Dashboard & Operational Interface

The **CivicResource Ai Frontend** is a modern, high-performance React application built with **Vite** and **Tailwind CSS**. It serves as the primary visualization and command layer for the CivicResource Ai platform.

## 📦 Key Technologies

- **React 18** (Vite + TypeScript)
- **Framer Motion**: Smooth, high-fidelity HUD-style animations.
- **Recharts**: Dynamic, reactive charting for the Intelligence Hub.
- **Lucide React**: Vector-based operational iconography.
- **Axios**: Custom API client with global JWT request interceptors (`src/lib/api.ts`).
- **TanStack Query**: Efficient client-side caching and state synchronization.

---

## 🏗️ Directory Structure

```plaintext
src/
├── components/       # Reusable UI components (AppLayout, ProtectedRoute, StatCard, etc.)
├── hooks/            # Custom React hooks (useToast, etc.)
├── lib/              # Core utilities (API client configuration, utility functions)
├── pages/            # View-level components (CommandCenter, IntelligenceHub, Login, etc.)
├── types/            # TypeScript interface definitions
├── App.tsx           # Global routing and context providers
└── main.tsx          # Application entry point
```

## 🔐 Security Architecture

- **Auth Layer**: Global token management in `localStorage` (`CivicResource Ai_token`).
- **Protected Routing**: The `ProtectedRoute.tsx` wrapper ensures that unauthorized users are redirected to `/login` before accessing the dashboard.
- **HTTP Interceptors**: The Axios client automatically injects the Bearer token into all requests sent to the backend.

---

## 🎨 Design System

**CivicResource Ai** follows the "Aether Urban" design language:
- **Base Color**: `Obsidian (#0A0C10)`
- **Accents**: `Electric Blue (#3B82F6)`, `Neon Amber`, `Neon Red`.
- **Styling**: Heavy use of **Glassmorphism**, subtle glow effects, and modern typography (Inter/Roboto).

---

## 🛠️ Performance Tuning

- **Polling Strategy**: Key operational views use a 10-second polling interval to simulate live real-time sync with database state.
- **Component Lazy Loading**: Use of Framer Motion’s `AnimatePresence` for fluid layout transitions while maintaining high frame rates.

---

## 🏁 Running Locally

```bash
npm install
npm run dev
```
The client will run on `http://localhost:5173`.
