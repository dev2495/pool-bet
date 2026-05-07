# Pool-Bet

A self-hosted, pari-mutuel betting app for friends. Players never bet against the
house — they bet against each other from a shared chip pool. The admin runs each
session, sets the rake, picks winners, and the pool is paid out automatically.

## What it does

- **Admin creates players.** You enter a name + phone, and the system generates a
  short login code (e.g. `BR4-92K`). Share that code with the player; that code is
  their only login credential.
- **Admin grants chips.** Each player gets a chip balance you control. Chips can
  be topped up at any time.
- **Admin builds a session.** A session is a "night" with one or more matches.
  Each match has an opponent name and 2–10 outcomes (Team A / Draw / Team B…).
- **Round 1 — blind bets.** Admin opens the session. Players see the matches and
  can place bets, but **odds are hidden** so no one can game the pool.
- **Round 2 — go live.** Admin clicks "Reveal odds & go LIVE". From this point
  odds are visible to everyone and **update with every new bet**, in real time
  (every ~2.5 seconds via polling).
- **Close & settle.** Admin closes betting, picks the winner of each match, and
  payouts run from the pool. Rake is taken off the top.

### Pari-mutuel math

For each match: `distributable = total_pool × (1 − rake)`. Winning bets are paid
`stake × (distributable / winning_pool)`. The house never has any exposure — only
players' chips ever pay players' chips.

## Stack

- **Next.js 14** App Router + TypeScript
- **Postgres 16** via Docker (a single container)
- **Prisma** for schema + queries
- **Tailwind** for styling
- **JWT cookie** session, **bcrypt** for the admin password
- All deps are pure JS — no native bindings

## Run it

You need Docker (for Postgres) and Node 18+.

```bash
# 1. Start the database
docker compose up -d

# 2. Install JS deps (this also runs `prisma generate`)
npm install

# 3. Push the schema and seed the default admin
npx prisma db push
npm run db:seed
# Default admin -> username: admin, password: admin123 (change in .env before seeding!)

# 4. Run the app
npm run dev
# open http://localhost:3000
```

That's it.

## Production

```bash
npm run build
npm start  # listens on :3000
```

Set `AUTH_SECRET` to a long random string and change `ADMIN_PASSWORD` before
running the seed in production. Put it behind a reverse proxy (nginx/Caddy) and
you're done.

## Routes

### Player

- `/` – sign in with your login code
- `/play` – live feed of sessions/matches; place bets; auto-refreshes
- `/history` – every bet you've ever placed, grouped by session, with P/L

### Admin

- `/admin/login` – admin sign-in
- `/admin` – dashboard: totals, sessions, leaderboard
- `/admin/users` – create players (generates the login code), top up chips
- `/admin/sessions/[id]` – manage one session: add matches, set rake, advance
  through DRAFT → OPEN → LIVE → CLOSED → SETTLED, and pick winners

## Data model (summary)

- `Admin` — username + bcrypt'd password
- `User` — the player; has `loginCode` (unique) and an integer `chips` balance
- `Session` — has `rakeBps` (rake in basis points; 500 = 5%) and a status
  enum: `DRAFT` → `OPEN` → `LIVE` → `CLOSED` → `SETTLED`
- `Match` — belongs to a session; has its own status enum
- `Outcome` — possible result on a match (cached `poolChips`/`betCount`)
- `Bet` — wager: user × match × outcome × stake; resolved with status + payout
- `Transaction` — append-only ledger for every chip movement

Every chip movement (grant, bet placement, win, refund) writes a row to
`Transaction` with `balanceAfter` so a full audit trail is always available.

## Architecture notes

- **Live odds via polling.** The `/play` page polls `/api/feed` every 2.5s; the
  admin session page polls `/api/admin/sessions/[id]` at the same rate. For a
  small group betting app this is simpler and far more reliable than running a
  WebSocket server. If you need true sub-second updates, swap polling for SSE
  on those two endpoints.
- **All financial mutations are wrapped in `prisma.$transaction`** — placing a
  bet, settling a match, and voiding a match all happen atomically.
- **Rounding favors the pool.** Per-bet payouts are `floor(stake × ratio)`; any
  rounding dust stays in the pool effectively as additional rake.
- **Edge cases.** If no one bet on the winning side, every stake is refunded
  (treat as void). If you void a match manually, every stake is refunded — no
  rake taken.

## File map

```
prisma/schema.prisma          – the entire data model
src/lib/odds.ts               – pari-mutuel math (computeOdds, computePayouts)
src/lib/auth.ts               – JWT cookie + requireUser/requireAdmin
src/lib/codes.ts              – login-code generator
src/app/api/...               – every API route
src/app/play/page.tsx         – player live feed + bet modal
src/app/admin/sessions/[id]   – session control panel
docker-compose.yml            – just Postgres
```

## Reset everything

```bash
docker compose down -v       # nukes the database volume
docker compose up -d
npx prisma db push
npm run db:seed
```

## Responsible play

This app is for chip-based, friend-group play. Chips are not money. There is no
deposit, no withdrawal, no payment integration. If you want to redeem chips
for anything, that's between the people sitting at the table.
