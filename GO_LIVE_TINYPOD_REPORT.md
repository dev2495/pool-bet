# Pool-Bet TinyPod Go-Live Report

Date: 2026-05-07

## Short Answer

Yes, this system can go live on TinyPod as a private chip-only beta.

TinyPod is a good fit for this app because it supports:

- GitHub deploy
- Dockerfile / Nixpacks / Buildpacks
- Docker Compose projects
- environment variables
- Postgres / MySQL / Redis database management
- custom domains with automatic SSL
- daily backups
- automatic redeploys from GitHub pushes

Cheapest realistic TinyPod price: $5/server/month.

Do not launch this publicly as real-money sports betting without legal review and licensing/compliance work.

## Correct TinyPod Source

The correct service is:

- https://tinypod.app
- https://tinypod.app/pricing
- https://tinypod.app/docs
- https://tinypod.app/byovps
- https://tinypod.app/dashboard

The `/dashboard` route is protected by Clerk auth, so it shows a protected/auth rewrite when not signed in. Public pages confirm the deployment and pricing model.

## TinyPod Pricing

TinyPod pricing page lists:

- Free trial: $0, 3 days, no card required
- Trial resources: 1 CPU core, 1GB RAM, 1GB storage
- Pro: $5/server/month
- Pro resources per server: 4 CPU cores, 8GB RAM, 75GB NVMe
- Pro includes unlimited apps/projects, GitHub deploy, Docker Compose deploy, environment variables, custom domains with auto SSL, and auto-deploy from GitHub pushes

TinyPod docs also say:

- Each server gives 4 CPU cores, 8GB RAM, 75GB NVMe
- Resources stack with more servers
- No bandwidth, per-deploy, support-tier, or egress fees are listed
- Apps stop if subscription lapses, but data is preserved

## Is $5/month Enough?

For a private beta: yes.

This app is light:

- Next.js server
- PostgreSQL
- polling every ~2.5 seconds on player/admin screens
- no file uploads
- no background workers
- no WebSocket server

One TinyPod server with 4 cores / 8GB RAM / 75GB storage is enough for a small private user group.

Expected initial allocation:

- App container: 512MB to 1GB RAM
- Postgres: 512MB to 1GB RAM
- Storage: 5GB to 10GB initial database volume

## Best TinyPod Deployment Path

Recommended path: GitHub deploy + managed/shared Postgres on TinyPod.

Why:

- Simpler than maintaining a custom Docker Compose production stack
- TinyPod supports Nixpacks/Buildpacks for Node apps
- TinyPod handles env vars, SSL, domains, logs, and backups
- Lowest operational work

Alternative path: Docker Compose.

This is also viable because TinyPod supports Docker Compose projects, but the current local `docker-compose.yml` only defines Postgres. For full Compose deployment, we should add a production app service and Dockerfile before deployment.

## Current Repo Readiness

Production checks already passed locally:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm audit --json` with 0 vulnerabilities
- `node /private/tmp/poolbet-e2e.mjs`
- `npm run ledger:test`
- browser check on `/admin/users`
- browser check on `/admin/ledger`

Current verified app behavior:

- New player starts at 0 chips
- Admin pay-in creates `PAY_IN`
- Bet placement creates `BET_PLACE`
- Winning payout creates `BET_WIN`
- Per-player settlement creates `PAY_OUT` and resets that player to 0
- Session settlement only resets players who actually participated in that session
- Unrelated funded players are not reset by session settlement
- House rake ledger reconciles
- Global ledger shows `MATCH`

## Production Blockers Before TinyPod Go-Live

These must be done before switching from local test to public URL:

1. Rotate secrets

Current local `.env` is not production-safe:

```env
AUTH_SECRET="dev-secret-please-change-in-production-must-be-32-chars-min"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
```

Production must use:

```env
AUTH_SECRET="long-random-32-plus-character-secret"
ADMIN_USERNAME="private-admin-name"
ADMIN_PASSWORD="strong-private-password"
DATABASE_URL="postgresql://..."
NODE_ENV="production"
```

2. Do not seed default admin in production

The seed script already refuses `admin123` in production. Use a real admin password before running:

```bash
npm run db:seed
```

3. Production database

Use TinyPod Postgres/database service or a Postgres container with a persistent volume.

4. Backups

TinyPod docs state daily backups and one-click restore. Before using real users, run one manual backup and test one restore.

5. Legal/compliance decision

For private chip-only testing, okay.

For real-money sports betting, not ready. Needs legal review, licensing, age/KYC, anti-fraud, terms, responsible gaming, audit retention, and stronger access controls.

## TinyPod Setup Plan

### Step 1: Sign in

Go to:

https://tinypod.app/dashboard

Create/sign into TinyPod.

### Step 2: Choose paid Pro after trial

Use the 3-day trial only for smoke testing. For real beta, use Pro at $5/server/month.

### Step 3: Connect GitHub repo

TinyPod docs path:

Projects -> New -> From GitHub

Build choice:

- Nixpacks if it detects Next.js correctly
- Buildpacks if you want manual commands
- Dockerfile if we add one

Manual build/start commands if needed:

```bash
npm ci
npm run build
npm start
```

The app’s default start script listens on port 3000:

```bash
next start -p 3000
```

### Step 4: Add PostgreSQL

Use TinyPod database support/Postgres service.

Set:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
```

### Step 5: Set environment variables

In TinyPod pod settings:

```env
NODE_ENV="production"
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
ADMIN_USERNAME="..."
ADMIN_PASSWORD="..."
```

### Step 6: Initialize schema

Run once:

```bash
npx prisma db push
npm run db:seed
```

For a more formal production lifecycle later, switch to Prisma migrations instead of `db push`.

### Step 7: Smoke test

After deployment:

- open `/admin/login`
- login with production admin
- create player
- pay in 100
- player logs in
- create session/match
- place bet
- close/settle match
- settle player
- verify `/admin/ledger` shows `MATCH`

### Step 8: Domain and SSL

TinyPod supports custom domains and auto SSL via Caddy.

Use a private subdomain first:

```text
pool.yourdomain.com
```

Keep it invite-only.

## Cheapest Recommendation

Use TinyPod Pro at $5/server/month.

Do not use a second server initially.

Do not pay for separate managed database unless TinyPod forces it. Keep app + Postgres on the same TinyPod server with persistent storage for the private beta.

Minimum monthly cost target:

```text
TinyPod Pro: $5/month
Domain: already owned or separate registrar cost
Total hosting: $5/month
```

## Risks Still Open

Technical:

- No production Dockerfile yet if you choose Dockerfile deploy.
- No formal Prisma migration history; current workflow uses `prisma db push`.
- No rate limiting on login endpoints.
- No automated scheduled restore test.
- No server-side audit export UI yet.

Product/legal:

- Sports betting mechanics are regulated if chips map to money/value.
- No age verification.
- No KYC.
- No state/location gating.
- No responsible-gaming controls.
- No terms/privacy flow.
- No payment integration by design, which is good for chip-only beta.

## Final Go / No-Go

Private chip-only beta on TinyPod: GO after secret rotation and production database setup.

Public real-money betting: NO-GO until legal/compliance and operational controls are built.

Best next engineering step:

Add TinyPod production deployment files:

- `Dockerfile`
- production `docker-compose.tinypod.yml`
- `TINYPOD_DEPLOY.md`
- backup/restore commands
- rate limiting on `/api/auth/login` and `/api/auth/admin/login`

