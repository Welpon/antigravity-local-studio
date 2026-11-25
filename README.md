# Local Studio for Antigravity

**SQLite & PostgreSQL Database Explorer + Localhost API Tester** right inside your Google Antigravity Side Pane and Sidebar.

- **Zero extra cost (0 tokens / 0 external APIs):** Runs 100% locally.
- **Zero-compile SQLite + full PostgreSQL:** Powered by Node's built-in `node:sqlite` and `pg`.
- **Try Instantly Without a Backend:** Includes built-in **Demo API Presets** and a 1-click **Demo SQLite Database**.
- **Bilingual UI (EN / TR):** English by default, with persistent one-click Turkish (`TR`) switching.

---

## Features

### 1. API Tester (`API Tester` / `API Testi`)
- Send `GET`, `POST`, `PUT`, `PATCH`, `DELETE` requests to `localhost` or any HTTP(S) endpoint.
- Custom JSON headers & request body, HTTP status + latency (`ms`) + response size badges, pretty-printed JSON viewer, and toggleable response headers.
- Persistent saved request collections, recent request history, and built-in **Demo Presets**.
- **✨ Debug / Types with AI:** Send any request + response payload straight to Antigravity chat to diagnose errors or generate TypeScript interfaces.

### 2. Database Explorer (`Database` / `Veritabanı`)
- **SQLite** (any `.sqlite` / `.db` file path) and **PostgreSQL** (`postgres://...` connection URL).
- **🧪 Create Demo DB:** Spins up a ready-to-use SQLite database (`users`, `projects`, `tasks`, `api_logs`) in one click so you can test immediately even without a backend project.
- Table picker with row counts, column schema chips (type & primary key), and Excel-style paginated data grid.
- **Safe SQL Runner:** Read-only by default (`SELECT`, `PRAGMA`, `EXPLAIN`, `WITH`, `SHOW`), with an explicit unlock toggle for write queries.
- **✨ Send Schema to AI:** Share exact table and column names with chat for accurate SQL, ORM, or API code generation.

---

## Installation

**Requirement:** Node.js **22.13+** / **24+** (for built-in `node:sqlite`).

### Windows (PowerShell)
```powershell
git clone https://github.com/Welpon/antigravity-local-studio.git "$env:USERPROFILE\.gemini\config\plugins\local-studio"
cd "$env:USERPROFILE\.gemini\config\plugins\local-studio"
npm install
```

### macOS / Linux
```bash
git clone https://github.com/Welpon/antigravity-local-studio.git ~/.gemini/config/plugins/local-studio
cd ~/.gemini/config/plugins/local-studio && npm install
```

### Without Git (ZIP Download)
1. Click **Code → Download ZIP** on GitHub.
2. Extract into `~/.gemini/config/plugins/local-studio`.
3. Open a terminal in that folder and run `npm install`.

Antigravity discovers the plugin automatically. Open it from the **Side Pane (`+` → Local Studio)** or **Sidebar (Plugins → Local Studio)**.

---

## Related Antigravity Plugins
- **[Context Brain](https://github.com/Welpon/antigravity-context-brain)** — Live Context Monitor, Markdown Memory Vault, Kanban & Activity Log
- **[Ship Guard](https://github.com/Welpon/antigravity-ship-guard)** — Git Flow, Safe Rollback, Secret Guard Hook, Quality Gate & GitHub Releases
- **[Local Studio](https://github.com/Welpon/antigravity-local-studio)** — SQLite / PostgreSQL Explorer & Localhost API Tester
- **[Project Studio](https://github.com/Welpon/antigravity-project-studio)** — Project Kickstart Scaffolder & Live UI Kit Previewer

## Contributing
Pull requests and issues are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for local development steps.

## License
[MIT](LICENSE)
