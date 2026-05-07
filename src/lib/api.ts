import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function err(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Wrap a route handler so thrown errors become tidy JSON responses.
export function handle<T>(fn: () => Promise<T>) {
  return fn().catch((e: unknown) => {
    if (e instanceof AuthError) return err(e.message, e.status);
    if (e instanceof ApiError) return err(e.message, e.status);
    if (e instanceof ZodError) return err("Validation failed", 400, { issues: e.flatten() });
    if (e instanceof Error) {
      console.error("[api]", e);
      return err(e.message || "Server error", 500);
    }
    console.error("[api] unknown", e);
    return err("Server error", 500);
  });
}
