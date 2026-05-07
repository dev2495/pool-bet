# TinyPod Deploy Notes

## Recommended TinyPod Path

Use `docker-compose.tinypod.yml` as a multi-container project so the app and Postgres are deployed together on one $5/month TinyPod server.

## Required Secrets

Set these in TinyPod before deploy:

```env
POSTGRES_PASSWORD="long-random-db-password"
AUTH_SECRET="long-random-32-plus-character-secret"
ADMIN_USERNAME="private-admin-username"
ADMIN_PASSWORD="strong-admin-password-not-admin123"
```

Do not use the local `.env` values in production.

## Compose File

Paste or point TinyPod to:

```text
docker-compose.tinypod.yml
```

The app starts with:

```bash
npm run start:prod
```

That runs:

```bash
prisma db push
npm run db:seed
next start -H 0.0.0.0 -p ${PORT:-3000}
```

The seed is safe to rerun. It skips the admin if it already exists and refuses `admin123` in production.

## First Smoke Test

After TinyPod gives the live URL:

1. Open `/admin/login`.
2. Log in with the production admin.
3. Open `/admin/users`.
4. Create a test player.
5. Pay in 100 chips.
6. Create a session and match.
7. Place one player bet.
8. Settle match.
9. Settle player.
10. Open `/admin/ledger` and confirm `MATCH`.

## Current Local Proof

These passed before deployment prep:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit --json
node /private/tmp/poolbet-e2e.mjs
npm run ledger:test
```
