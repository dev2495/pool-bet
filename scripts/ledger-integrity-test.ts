import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let failures = 0;

function check(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

async function main() {
  const users = await prisma.user.findMany({
    include: { ledger: true },
  });
  for (const user of users) {
    const ledgerBalance = user.ledger.reduce((sum, t) => sum + t.amount, 0);
    check(
      ledgerBalance === user.chips,
      `player ledger equals chips for ${user.loginCode} (${ledgerBalance} == ${user.chips})`
    );

    const sortedLedger = [...user.ledger].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const isSettlementPayout = (note: string | null, type: string, balanceAfter: number) =>
      (type === "PAY_OUT" && balanceAfter === 0) || note?.startsWith("Session settled reset:");
    const latestSettlementIndex = sortedLedger.findIndex((t) =>
      isSettlementPayout(t.note, t.type, t.balanceAfter)
    );
    const currentCycleRows =
      latestSettlementIndex === -1 ? sortedLedger : sortedLedger.slice(0, latestSettlementIndex);
    const currentCycleBalance = currentCycleRows.reduce((sum, t) => sum + t.amount, 0);
    check(
      currentCycleBalance === user.chips,
      `player current cycle starts after latest settlement for ${user.loginCode} (${currentCycleBalance} == ${user.chips})`
    );

    for (const txn of user.ledger) {
      if (txn.type === "PAY_IN") {
        check(txn.amount > 0, `pay-in is positive for ${txn.id}`);
      }
      if (txn.type === "PAY_OUT") {
        check(txn.amount < 0, `payout is negative for ${txn.id}`);
        check(txn.balanceAfter >= 0, `payout leaves non-negative balance for ${txn.id}`);
      }
    }
  }

  const playerLedgerTotal = users.flatMap((u) => u.ledger).reduce((sum, t) => sum + t.amount, 0);
  const chipsInPlay = users.reduce((sum, u) => sum + u.chips, 0);
  check(playerLedgerTotal === chipsInPlay, `global player ledger equals chips in play (${playerLedgerTotal} == ${chipsInPlay})`);

  const settledMatches = await prisma.match.findMany({
    where: { status: "SETTLED" },
    include: { bets: true, houseLedger: true, session: true },
  });
  for (const match of settledMatches) {
    const totalPool = match.bets.reduce((sum, b) => sum + b.stake, 0);
    const totalPaid = match.bets.reduce((sum, b) => sum + b.payout, 0);
    const expectedHouse = Math.max(0, totalPool - totalPaid);
    check(!!match.houseLedger, `house ledger exists for settled match ${match.id}`);
    if (match.houseLedger) {
      check(match.houseLedger.amount === expectedHouse, `house rake matches pool-paid for ${match.id} (${match.houseLedger.amount} == ${expectedHouse})`);
      check(match.houseLedger.totalPool === totalPool, `house total pool matches bets for ${match.id}`);
      check(match.houseLedger.totalPaid === totalPaid, `house total paid matches bets for ${match.id}`);
      check(match.houseLedger.sessionId === match.sessionId, `house session id matches match session for ${match.id}`);
    }
  }

  const bets = await prisma.bet.findMany({
    include: { match: true },
  });
  const betSessionKeys = new Set(bets.map((b) => `${b.userId}:${b.match.sessionId}`));
  for (const bet of bets) {
    const placement = await prisma.transaction.findMany({
      where: { betId: bet.id, type: "BET_PLACE" },
    });
    check(placement.length === 1 && placement[0].amount === -bet.stake, `bet placement ledger exists for ${bet.id}`);
    if (bet.payout > 0) {
      const payoutRows = await prisma.transaction.findMany({
        where: { betId: bet.id, type: { in: ["BET_WIN", "BET_REFUND"] } },
      });
      const paid = payoutRows.reduce((sum, t) => sum + t.amount, 0);
      check(paid === bet.payout, `bet payout ledger matches payout for ${bet.id}`);
    }
  }

  const sessionPayouts = await prisma.transaction.findMany({
    where: { type: "PAY_OUT", sessionId: { not: null } },
  });
  for (const payout of sessionPayouts) {
    check(
      betSessionKeys.has(`${payout.userId}:${payout.sessionId}`),
      `session payout belongs to a player in that session for ${payout.id}`
    );
  }

  const sessions = await prisma.session.findMany({
    where: { status: "SETTLED" },
    include: {
      matches: { include: { bets: true, houseLedger: true } },
      houseLedger: true,
    },
  });
  for (const session of sessions) {
    const pool = session.matches.flatMap((m) => m.bets).reduce((sum, b) => sum + b.stake, 0);
    const paid = session.matches.flatMap((m) => m.bets).reduce((sum, b) => sum + b.payout, 0);
    const house = session.houseLedger.reduce((sum, h) => sum + h.amount, 0);
    check(house === Math.max(0, pool - paid), `session house ledger reconciles for ${session.id}`);
  }

  if (failures > 0) {
    throw new Error(`${failures} ledger integrity check(s) failed`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
