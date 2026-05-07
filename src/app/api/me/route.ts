import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const s = await getSession();
    if (!s) return ok({ session: null });
    if (s.kind === "admin") {
      const a = await prisma.admin.findUnique({ where: { id: s.adminId } });
      return ok({
        session: a ? { kind: "admin", username: a.username } : null,
      });
    }
    const u = await prisma.user.findUnique({ where: { id: s.userId } });
    return ok({
      session: u
        ? { kind: "user", id: u.id, name: u.name, chips: u.chips, loginCode: u.loginCode }
        : null,
    });
  });
}
