import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-change-me-must-be-32-chars-long"
);

export type Session =
  | { kind: "user"; userId: string }
  | { kind: "admin"; adminId: string };

const COOKIE_NAME = "poolbet_session";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // 30 days
  maxAge: 60 * 60 * 24 * 30,
};

async function sign(payload: Session): Promise<string> {
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

async function verify(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.kind === "user" && typeof payload.userId === "string") {
      return { kind: "user", userId: payload.userId };
    }
    if (payload.kind === "admin" && typeof payload.adminId === "string") {
      return { kind: "admin", adminId: payload.adminId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSession(s: Session) {
  const token = await sign(s);
  (await cookies()).set(COOKIE_NAME, token, COOKIE_OPTS);
}

export async function clearSession() {
  (await cookies()).set(COOKIE_NAME, "", { ...COOKIE_OPTS, maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const c = (await cookies()).get(COOKIE_NAME);
  if (!c?.value) return null;
  return await verify(c.value);
}

export async function requireUser() {
  const s = await getSession();
  if (!s || s.kind !== "user") throw new AuthError("Not signed in", 401);
  const user = await prisma.user.findUnique({ where: { id: s.userId } });
  if (!user) throw new AuthError("User not found", 401);
  return user;
}

export async function requireAdmin() {
  const s = await getSession();
  if (!s || s.kind !== "admin") throw new AuthError("Admin only", 403);
  const admin = await prisma.admin.findUnique({ where: { id: s.adminId } });
  if (!admin) throw new AuthError("Admin not found", 401);
  return admin;
}

export class AuthError extends Error {
  status: number;
  constructor(msg: string, status = 401) {
    super(msg);
    this.status = status;
  }
}
