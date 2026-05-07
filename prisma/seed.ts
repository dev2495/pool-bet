import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { IPL_2026_REMAINING_FIXTURES, teamName } from "../src/lib/ipl";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || "devarsh";
  const password = process.env.ADMIN_PASSWORD || "admin123456";

  if (process.env.NODE_ENV === "production" && password === "admin123") {
    throw new Error("Refusing to seed production with the default admin password.");
  }

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" already exists. Skipping.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.admin.create({ data: { username, passwordHash } });
    console.log(`Created admin "${username}".`);
    console.log("Rotate it after first login.");
  }

  await seedIplSchedule();
}

async function seedIplSchedule() {
  const existingSession = await prisma.session.findFirst({
    where: { name: "IPL 2026 Remaining Matches" },
  });
  const session = existingSession
    ? await prisma.session.update({
        where: { id: existingSession.id },
        data: { rakeBps: 500, status: "OPEN" },
      })
    : await prisma.session.create({
        data: { name: "IPL 2026 Remaining Matches", rakeBps: 500, status: "OPEN" },
      });

  let created = 0;
  let updated = 0;

  for (const fixture of IPL_2026_REMAINING_FIXTURES) {
    const startsAt = new Date(fixture.startsAt);
    const bettingOpensAt = new Date(startsAt.getTime() - 60 * 60 * 1000);
    const homeName = teamName(fixture.home);
    const awayName = teamName(fixture.away);
    const matchName = fixture.label
      ? `IPL 2026 ${fixture.label}: ${homeName} vs ${awayName}`
      : `IPL 2026 Match ${fixture.matchNo}: ${homeName} vs ${awayName}`;
    const description = `${fixture.venue} · betting opens 1 hour before scheduled start`;

    const existing = await prisma.match.findFirst({
      where: { source: "IPL 2026", name: matchName },
      include: { outcomes: true },
    });

    if (existing) {
      await prisma.match.update({
        where: { id: existing.id },
        data: {
          sessionId: session.id,
          description,
          startsAt,
          bettingOpensAt,
          source: "IPL 2026",
          homeCode: fixture.home,
          awayCode: fixture.away,
          status: existing.status === "PENDING" ? "OPEN" : existing.status,
        },
      });
      updated += 1;
      continue;
    }

    await prisma.match.create({
      data: {
        sessionId: session.id,
        name: matchName,
        description,
        startsAt,
        bettingOpensAt,
        source: "IPL 2026",
        homeCode: fixture.home,
        awayCode: fixture.away,
        status: "OPEN",
        outcomes: {
          create: [
            { label: fixture.home === "TBD" ? "Team 1" : homeName },
            { label: fixture.away === "TBD" ? "Team 2" : awayName },
          ],
        },
      },
    });
    created += 1;
  }

  console.log(`IPL 2026 schedule seeded. Created ${created}, updated ${updated}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
