# Jonte Test — Hello World PWA

A single-page "Hello World" experience that looks great on mobile and desktop. Built with semantic HTML, responsive CSS, progressive web app features — plus a server-side BMC Remedy login proxy.

## Run locally (with login proxy)

```bash
npm install
npm run dev # serves UI + /api/bmc-token proxy on http://localhost:4173
```

The `/api/bmc-token` endpoint forwards credentials to `https://saas02.tandis.app:8443/api/jwt/login`, keeping the call server-side so the browser never hits the BMC domain directly (avoids CORS issues).

## Static preview only

If you just want the UI without the proxy, you can run:

```bash
python3 -m http.server 4173
# open http://localhost:4173 (login form will not work without the Node proxy)
```

## PWA features

- 📱 Mobile-first layout (fluid spacing, clamp-based typography)
- 🌫️ Glassmorphism card with animated sparkles
- 📲 Installable via `manifest.json` + service worker
- ⚡ Offline cache for all core assets
- 🛡 Server-side proxy for BMC token retrieval
- 🪶 Zero frontend dependencies

## Deploying

- For the UI alone, any static host works (GitHub Pages, Cloudflare Pages, Netlify, Vercel).
- For token fetching, deploy `server.js` (or port it to your preferred platform) so `/api/bmc-token` runs server-side with HTTPS access to BMC.
