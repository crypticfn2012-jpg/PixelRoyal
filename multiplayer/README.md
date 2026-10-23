# PixelRoyale online multiplayer

This folder contains the Cloudflare Worker used by the PixelRoyale browser game.

## Deploy using the Worker project already created on your PC

The Worker project at `C:\Users\crypt\pixelroyal-multiplayer` already has Wrangler and the Durable Object binding configured. In PowerShell, run:

```powershell
cd C:\Users\crypt\pixelroyal-multiplayer
curl.exe -L "https://raw.githubusercontent.com/crypticfn2012-jpg/PixelRoyale/main/multiplayer/src/index.js" -o src/index.js
npm run dev
```

Leave the development server running. In another PowerShell window, test health and room creation:

```powershell
curl.exe "http://127.0.0.1:8787/health"
curl.exe -X POST "http://127.0.0.1:8787/api/rooms" -H "Content-Type: application/json" --data-raw '{"mode":"br"}'
```

Room creation should return a six-character `code`. Once both tests work, stop the dev server with **Ctrl+C**, then deploy:

```powershell
npx wrangler deploy
```

Wrangler prints the public `workers.dev` URL. The game needs that exact URL configured as `MP_WORKER_URL` in the multiplayer section near the bottom of `index.html`. Share the URL with the project maintainer so the site can be wired to the deployed Worker.

## Current protocol

- `GET /health`
- `POST /api/rooms` with `{"mode":"br"}` or `{"mode":"box"}`
- `GET /api/rooms/CODE`
- `GET /ws?mode=br` or `GET /ws?mode=box` for public matchmaking
- `GET /ws?room=CODE` for private rooms

The game keeps its existing bot opponents active while public matchmaking waits. The Worker relays player state and shot packets between connected clients. This is an early real-time relay, not a server-authoritative anti-cheat system; validate with two browser clients before submitting it to CrazyGames.
