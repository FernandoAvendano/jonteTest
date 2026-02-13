# Tandis AI Console

A mobile-friendly Tandis control panel: authenticate with BMC Remedy, then stream the latest orders and related data (services, tasks, attachments, comments) through a secure proxy that runs on this machine.

## Run locally (with proxy)

```bash
npm install
npm run dev # serves UI + /api/* proxy on http://localhost:4173
```

- `POST /api/bmc-token` → forwards to `https://saas02.tandis.app:8443/api/jwt/login`
- `POST /api/orders` → forwards to `.../BTS:SOT:Order`
- `POST /api/order-services` → forwards to `.../BTS:SOT:Order:Service`
- `POST /api/order-tasks` → forwards to `.../BTS:SOT:Order:ServiceTask`
- `POST /api/order-materials` → forwards to `.../BTS:SOT:Order:Material`
- `POST /api/order-attachments-list` → forwards to `.../BTS:SOT:Order:Attachments?limit=...`
- `POST /api/order-attachment-file` → streams a single attachment file through the proxy
- `POST /api/order-comments` → forwards to `.../BTS:SOT:OrderComment`

## Static preview (UI only)

```bash
python3 -m http.server 4173
# open http://localhost:4173 (login/orders require the Node proxy)
```

## Product notes

- 📱 Tandis-branded UI optimized for phones
- 🔐 Credentials stay client-side; JWT/token exchange & API calls handled server-side
- 📋 Orders auto-load after login + manual refresh button
- 🧩 Order detail view for services, tasks, materials, attachments, comments
- 📱 Mobile: inline accordion per order · Desktop: split view panel
- 🔄 In-app "Refresh app" button clears caches + service workers to bust mobile cache
- 📎 Attachment download proxy keeps AR-JWT off the browser
- 📲 Installable PWA with offline shell

## Deployment

- Frontend runs on GitHub Pages; it targets the live backend via ngrok (`https://lexicostatistical-seamanly-elle.ngrok-free.dev`).
- Keep `npm run dev` + ngrok alive on this Mac, or host the proxy elsewhere and update `API_BASE` accordingly.
