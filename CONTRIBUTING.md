# Contributing to Local Studio

1. Clone into `~/.gemini/config/plugins/local-studio`.
2. Run `npm install` and `npm run build:ui`.
3. Verify syntax:
   ```bash
   node --check server/index.mjs server/db.mjs server/http.mjs ui/build.mjs
   ```
4. Keep both **English (`en`)** and **Turkish (`tr`)** translations updated in `ui/app.js`.
5. Never commit local `.sqlite` / `.db` files, credentials, or personal paths.
