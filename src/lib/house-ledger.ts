import type { Prisma } from "@prisma/client";

export async function recordHouseRake(
  tx: Prisma.TransactionClient,
  args: {
    matchId: string;
    sessionId: string;
    rakeBps: number;
    totalPool: number;
    totalPaid: number;
    note: string;
  }
) {
  const amount = Math.max(0, args.totalPool - args.totalPaid);
  await tx.houseTransaction.upsert({
    where: { matchId: args.matchId },
    create: {
      type: "RAKE",
      amount,
      totalPool: args.totalPool,
      totalPaid: args.totalPaid,
      rakeBps: args.rakeBps,
      matchId: args.matchId,
      sessionId: args.sessionId,
      note: args.note,
    },
    update: {
      amount,
      totalPool: args.totalPool,
      totalPaid: args.totalPaid,
      rakeBps: args.rakeBps,
      sessionId: args.sessionId,
      note: args.note,
    },
  });
  return amount;
}
