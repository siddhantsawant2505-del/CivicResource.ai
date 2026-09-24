# CivicResource Mobile App

This mobile app provides two roles:
- Citizen: file complaint, track complaint, multilingual UI, location assist, and status notifications.
- Worker: login, load unit assignments, simplified worker HUD, and assignment notifications.

## 1. Prerequisites
- Node.js 18+
- Android Studio with Android SDK + emulator
- Backend server running (`server`) and AI engine running (`ai-engine`)

## 2. Setup
1. Open terminal in `mobile-app`.
2. Install packages:
   - `npm install`
3. Create env file:
   - Copy `.env.example` to `.env`
4. Verify URLs for Android emulator:
   - `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:5000/api`
   - `EXPO_PUBLIC_AI_ENGINE_URL=http://10.0.2.2:8000`

## 3. Run on Android Studio Emulator
1. Start backend server in `server`:
   - `npm run dev`
2. Start AI engine in `ai-engine`:
   - activate venv and run FastAPI app (your existing command flow)
3. Start Android emulator from Android Studio Device Manager.
4. In `mobile-app`, run:
   - `npm run android`

## 4. Useful Commands
- `npm run start` - start Expo dev server
- `npm run android` - build and launch on Android emulator/device
- `npm run web` - quick web preview

## 5. Notes
- If there is no internet, citizen complaints are queued locally and auto-submitted when connectivity returns.
- Notifications are local notifications triggered by polling updates from backend APIs.
- Worker flow uses `Unit ID` (for seeded data: `POL-101`, `FIR-204`, `MED-115`, `UTL-320`, `SAN-410`).
