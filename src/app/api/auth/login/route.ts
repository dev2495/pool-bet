import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";
import { handle, ok, err } from "@/lib/api";

const Body = z.object({ code: z.string().min(3).max(40) });

export async function POST(req: NextRequest) {
  return handle(async () => {
    const json = await req.json();
    const { code } = Body.parse(json);
    const norm = code.trim().toUpperCase();
    const user = await prisma.user.findUnique({ where: { loginCode: norm } });
    if (!user) return err("Invalid code", 401);
    await setSession({ kind: "user", userId: user.id });
    return ok({ user: { id: user.id, name: user.name, chips: user.chips } });
  });
}
