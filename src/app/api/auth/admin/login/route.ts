import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";

const Body = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { username, password } = Body.parse(await req.json());
    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) return err("Invalid credentials", 401);
    const okPw = await bcrypt.compare(password, admin.passwordHash);
    if (!okPw) return err("Invalid credentials", 401);
    await setSession({ kind: "admin", adminId: admin.id });
    return ok({ admin: { id: admin.id, username: admin.username } });
  });
}
