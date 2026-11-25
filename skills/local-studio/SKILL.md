---
name: local-studio
description: Explore SQLite and PostgreSQL databases (tables, schemas, safe SQL queries) and test localhost or remote HTTP API endpoints without leaving Antigravity. Use when inspecting local databases, testing REST APIs, or sending database schemas and API responses to the agent.
---

# Local Studio Skill

Use the `local-studio` MCP tools when the user wants to inspect a local database or test HTTP endpoints:

- **`open_local_studio`**: Opens the interactive 2-tab side pane (`API Tester` and `Database Explorer`).
- **`db_create_demo`**: Creates a ready-to-use sample SQLite database (`users`, `projects`, `tasks`, `api_logs`) for testing without an existing backend.
- **`db_inspect`**: Inspects tables, row counts, and column schemas for a SQLite file path or `postgres://` connection string.
- **`db_preview_table`**: Fetches paginated rows from a table.
- **`db_run_query`**: Runs a SQL query (read-only by default; pass `allow_write: true` only when the user explicitly requests mutations).
- **`http_request`**: Sends `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` requests and returns status, timing, headers, and formatted JSON/text body.
