# Jonte Test — Hello World PWA

A polished "Hello World" PWA that doubles as a lightweight BMC Remedy client: login to JWT, then pull the latest orders via the server-side proxy.

## Run locally (with proxy)

```bash
npm install
npm run dev # serves UI + /api/* proxy on http://localhost:4173
```

- `POST /api/bmc-token` → forwards to `https://saas02.tandis.app:8443/api/jwt/login`
- `POST /api/orders` → forwards to `https://saas02.tandis.app:8443/api/arsys/v1/entry/BTS:SOT:Order?...`

Both endpoints stay server-side to avoid CORS and keep credentials/tokens off the client.

## Static preview only

```bash
python3 -m http.server 4173
# open http://localhost:4173 (login/orders require the Node proxy)
```

## PWA features

- 📱 Mobile-first layout (fluid spacing, clamp-based typography)
- 🌫️ Glassmorphism card with animated sparkles
- 📲 Installable via `manifest.json` + service worker
- ⚡ Offline cache for core assets
- 🔐 Credential form + JWT token display
- 📋 Orders list renderer (latest 10 orders)

## Deploying

- Frontend is served on GitHub Pages; JS points to the ngrok-exposed backend (`https://lexicostatistical-seamanly-elle.ngrok-free.dev`).
- Backend (`server.js`) must run on this machine (or any Node host) with TLS verification disabled to hit the Remedy instance. Keep ngrok alive or swap in a permanent domain.
