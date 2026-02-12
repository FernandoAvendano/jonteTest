# Tandis AI Console

A mobile-friendly Tandis control panel: authenticate with BMC Remedy, then stream the latest orders through a secure proxy that runs on this machine.

## Run locally (with proxy)

```bash
npm install
npm run dev # serves UI + /api/* proxy on http://localhost:4173
```

- `POST /api/bmc-token` → forwards to `https://saas02.tandis.app:8443/api/jwt/login`
- `POST /api/orders` → forwards to `https://saas02.tandis.app:8443/api/arsys/v1/entry/BTS:SOT:Order?...`

## Static preview (UI only)

```bash
python3 -m http.server 4173
# open http://localhost:4173 (login/orders require the Node proxy)
```

## Product notes

- 📱 Tandis-branded UI optimized for phones
- 🔐 Credentials stay client-side; JWT/token exchange handled server-side
- 📋 Orders auto-load after login + manual refresh button
- 📲 Installable PWA with offline shell

## Deployment

- Frontend runs on GitHub Pages; it targets the live backend via ngrok (`https://lexicostatistical-seamanly-elle.ngrok-free.dev`).
- Keep `npm run dev` + ngrok alive on this Mac, or host the proxy elsewhere and update `API_BASE` accordingly.
