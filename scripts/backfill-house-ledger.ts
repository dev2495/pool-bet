import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.match.findMany({
    where: {
      status: "SETTLED",
      houseLedger: null,
    },
    include: { bets: true, session: true },
  });

  for (const match of matches) {
    const totalPool = match.bets.reduce((sum, bet) => sum + bet.stake, 0);
    const totalPaid = match.bets.reduce((sum, bet) => sum + bet.payout, 0);
    await prisma.houseTransaction.create({
      data: {
        type: "RAKE",
        amount: Math.max(0, totalPool - totalPaid),
        totalPool,
        totalPaid,
        rakeBps: match.session.rakeBps,
        matchId: match.id,
        sessionId: match.sessionId,
        note: `Backfilled rake retained for ${match.name}`,
        createdAt: match.settledAt || new Date(),
      },
    });
  }
  console.log(`Backfilled ${matches.length} house ledger row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
