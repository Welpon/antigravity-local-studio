# Local Studio — Antigravity MCP App Plugin

**SQLite & PostgreSQL Database Explorer + Localhost API Tester** right inside your Antigravity Side Pane and Sidebar.

## Features

- **API Tester (Mini Postman):**
  - Send `GET`, `POST`, `PUT`, `PATCH`, `DELETE` requests to `localhost` or any HTTP(S) endpoint.
  - Custom JSON headers & request body, status code + latency + size badges, pretty-printed JSON response viewer.
  - Persistent saved request collections, recent request history, and built-in **Demo Presets** for instant 1-click testing.
  - **Debug / Generate Types with AI:** Send any request + response payload straight to the Antigravity chat.
- **Database Explorer (SQLite & PostgreSQL):**
  - Zero-compile **SQLite** support (powered by Node's built-in `node:sqlite`) and full **PostgreSQL** (`postgres://...`) support.
  - **1-Click Demo SQLite DB:** Spin up a sample database (`users`, `projects`, `tasks`, `api_logs`) immediately even if you don't have a backend project yet.
  - Table list with row counts, column schema badges, Excel-style paginated data grid.
  - **Safe SQL Runner:** Read-only by default (`SELECT`, `PRAGMA`, `EXPLAIN`, `WITH`, `SHOW`), with an explicit unlock toggle for write queries.
  - **Send Schema to AI:** Share table definitions directly with the chat for instant SQL, ORM, or API code generation.
- **Bilingual UI:** English (`EN`) primary, Turkish (`TR`) secondary, persisted locally.

## Installation

1. Clone this repository into your Antigravity plugins folder (`~/.gemini/config/plugins/local-studio`).
2. Install dependencies and build the UI:
   ```bash
   npm install
   npm run build:ui
   ```
3. Reload MCP servers or restart Antigravity, then open **Local Studio** from the Sidebar or Side Pane.

## Requirements

- Node.js **22.13+** / **24+** (for built-in `node:sqlite`).

## License

MIT
