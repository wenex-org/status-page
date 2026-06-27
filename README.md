# Status Page

A lightweight, elegant status page built with **Express (MVC) + TypeScript**, a
**Vue 3 + Tailwind** frontend (dark/light), and **SQLite** for storage.

- **Public page** (`/`) — live up/down status of every tracked service,
  organised into **groups** (each with its own aggregate status), an uptime
  bar, 24h uptime %, and an announcements/notice banner.
- **Service groups** — configurable categories (e.g. Gateway, Services,
  Workers, Infra). Defaults are seeded on first run and can be added, renamed,
  reordered and deleted from the admin panel. Each service may belong to one
  group (or none → shown under "Other").
- **Admin panel** (`/admin`, HTTP Basic Auth) — manage groups and services,
  post announcements, and change the admin username/password.
- **Monitoring** — each service is polled on a configurable interval (5 or 15
  minutes). Endpoints are expected to return the
  [NestJS Terminus / wenex gateway](https://gateway.wenex.org/status) format
  (`{ "status": "ok", ... }`). History is retained for 3 months, then pruned.

## Requirements

- Node.js `>=22 <23`
- pnpm `10.5.2` (`corepack enable` will provision it from the `packageManager` field)
- A non-Windows OS

## Setup

```bash
cd status-page
cp .env.example .env        # optional — sensible defaults are built in
pnpm install                # builds the better-sqlite3 native addon
```

> `better-sqlite3` is a native module. Its build is allow-listed via the
> `pnpm.onlyBuiltDependencies` field in `package.json`. If the binding is ever
> missing, run `pnpm rebuild better-sqlite3`.

## Run

```bash
pnpm dev      # watch mode (tsx)
# or
pnpm build && pnpm start
```

Then open:

- Public page: <http://localhost:3000/>
- Admin panel: <http://localhost:3000/admin> (default login `admin` / `admin`)

**Change the default password immediately** from the admin **Account** tab.

## Code quality

```bash
pnpm lint          # ESLint (flat config, typescript-eslint)
pnpm lint:fix      # ESLint with autofix
pnpm format        # Prettier — write
pnpm format:check  # Prettier — verify only
```

ESLint and Prettier are wired so they don't fight (`eslint-config-prettier`).
The CDN-based browser frontend under `public/` is excluded from linting.

## Configuration (`.env`)

| Variable           | Default   | Description                                 |
| ------------------ | --------- | ------------------------------------------- |
| `PORT`             | `3000`    | HTTP port                                   |
| `HOST`             | `0.0.0.0` | Bind address                                |
| `ADMIN_USERNAME`   | `admin`   | Seed admin username (only when DB is empty) |
| `ADMIN_PASSWORD`   | `admin`   | Seed admin password (only when DB is empty) |
| `RETENTION_DAYS`   | `90`      | History retention before daily pruning      |
| `CHECK_TIMEOUT_MS` | `10000`   | Per-check HTTP timeout                      |

## Project structure (MVC)

```
status-page/
├── src/
│   ├── server.ts              # entry point (init DB, seed, scheduler, listen)
│   ├── app.ts                 # Express app + route wiring
│   ├── config.ts              # typed env configuration
│   ├── db/
│   │   ├── index.ts           # SQLite connection (better-sqlite3)
│   │   └── schema.sql         # schema: groups, resources, status_history, news, credentials
│   ├── models/                # data access (one module per table) + types
│   ├── services/              # checker, scheduler, status aggregation
│   ├── controllers/           # request handlers (status, group, admin)
│   ├── routes/                # public API + admin routes
│   └── middleware/            # HTTP Basic Auth guard
└── public/                    # Vue + Tailwind frontend (no build step, CDN)
    ├── index.html / app.js    # public status page
    ├── admin.html / admin.js  # admin panel
    └── styles.css
```

## How status & downtime are computed

- Every executed check writes one row to `status_history` (up/down, latency,
  HTTP code, detail).
- A service is **up** when the endpoint responds `2xx` with body `status` of
  `ok`/`up` (falls back to the HTTP status when the body isn't JSON).
- **Uptime %** over a window = `successful checks / expected checks`, where
  expected checks are derived from the service's interval. This means a _missed_
  interval (process down, network gone) counts as downtime, exactly like a
  recorded failure — per the downtime rule.

## API

Public:

- `GET /api/status` — overall summary, status grouped by category, active news.
- `GET /api/news` — active announcements.

Admin (Basic Auth):

- `GET /admin/api/meta` — configurable choices (allowed polling intervals)
- `GET|POST /admin/api/groups`, `PUT|DELETE /admin/api/groups/:id`,
  `POST /admin/api/groups/reorder` (body `{ ids: number[] }`)
- `GET|POST /admin/api/resources`, `PUT|DELETE /admin/api/resources/:id`,
  `POST /admin/api/resources/:id/check` (resources accept an optional `groupId`)
- `GET|POST /admin/api/news`, `PUT|DELETE /admin/api/news/:id`
- `GET|PUT /admin/api/account`

Default groups and the allowed polling intervals are configured in
[`src/config.ts`](src/config.ts) (`defaultGroups`, `allowedIntervals`).
