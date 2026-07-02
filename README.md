# Glob

Self-hosted fitness tracking PWA. Log workouts, track nutrition with barcode scanning, and monitor sleep and supplements — installable on mobile from your browser.

## Screenshots

<!-- TODO: add screenshots -->

## Features

- **Workouts** — exercise library, reusable session templates, set/rep/weight/RPE logging
- **Nutrition** — food library, barcode scanner, macro targets, USDA FoodData Central search
- **Sleep** — duration and quality logging
- **Supplements** — daily supplement tracking
- **Dashboard** — recent history at a glance
- **PWA** — installable on iOS and Android from the browser

## Tech Stack

| Layer    | Technologies |
|----------|--------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router v7, TanStack Query, vite-plugin-pwa |
| Backend  | Node.js, Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 |
| Auth     | JWT via HTTP-only cookies, bcrypt |

## Self-Hosting

Requires Docker and Docker Compose. Three containers are started: PostgreSQL, the backend API, and nginx serving the frontend.

```sh
git clone https://github.com/johnjmartin97/glob.git
cd glob
cp .env.example .env   # set JWT_SECRET and USDA_API_KEY at minimum
docker compose up -d
```

Open http://localhost. Migrations run automatically on first boot.

### Minimum env vars

| Variable       | Description |
|----------------|-------------|
| `JWT_SECRET`   | Any long random string |
| `USDA_API_KEY` | [FoodData Central API key](https://fdc.nal.usda.gov/api-guide.html). `DEMO_KEY` works but is rate-limited. |

Other vars (`JWT_EXPIRES_IN`, `COOKIE_SECURE`, `CORS_ORIGIN`) have usable defaults. Set `COOKIE_SECURE=true` if terminating TLS in front of nginx.

## Local Dev

Requires Node 22+ and PostgreSQL (or run `docker compose up postgres -d` for just the DB).

```sh
git clone https://github.com/johnjmartin97/glob.git
cd glob
npm install
cp .env.example .env     # set DATABASE_URL, JWT_SECRET, and other vars
npm run db:migrate
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Scripts

| Command               | Description                              |
|-----------------------|------------------------------------------|
| `npm run dev`         | Start frontend and backend concurrently  |
| `npm run build`       | Build all workspaces                     |
| `npm run db:migrate`  | Apply pending Drizzle migrations         |
| `npm run db:generate` | Generate migrations from schema changes  |
| `npm run db:seed`     | Seed sample data                         |

## Environment Variables

Full reference — see `.env.example`.

| Variable         | Default                 | Notes |
|------------------|-------------------------|-------|
| `DATABASE_URL`   | —                       | PostgreSQL connection string |
| `JWT_SECRET`     | —                       | Required. Use a long random string. |
| `JWT_EXPIRES_IN` | `30d`                   | Token lifetime |
| `COOKIE_SECURE`  | `false`                 | Set `true` when running behind HTTPS |
| `PORT`           | `3001`                  | Backend listen port |
| `CORS_ORIGIN`    | `http://localhost:5173` | Allowed CORS origin for local dev |
| `USDA_API_KEY`   | `DEMO_KEY`              | FoodData Central key |

> `.env.example` also contains `LLM_*` variables left over from a coaching feature that was removed. These can be ignored.

## Contributing

PRs are welcome. Open an issue first for anything significant.
