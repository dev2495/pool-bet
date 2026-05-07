"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Me =
  | { kind: "user"; id: string; name: string; chips: number; loginCode: string }
  | { kind: "admin"; username: string }
  | null;

export default function Nav({ active }: { active?: "play" | "history" | "admin" }) {
  const [me, setMe] = useState<Me>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((j) => setMe(j?.data?.session ?? null))
      .catch(() => setMe(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const navClass = (key: "play" | "history" | "admin") =>
    "rounded-md px-2.5 py-1.5 transition " +
    (active === key ? "bg-panel2 text-ink" : "text-muted hover:bg-panel2/70 hover:text-ink");

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/78 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="font-bold text-ink flex items-center gap-2 tracking-tight">
          <span className="inline-block w-2 h-2 rounded-full bg-accent shadow-[0_0_16px_rgba(93,214,246,0.8)]" />
          Pool&#8209;Bet
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          {me?.kind === "user" && (
            <>
              <Link href="/play" className={navClass("play")}>
                Play
              </Link>
              <Link href="/history" className={navClass("history")}>
                History
              </Link>
            </>
          )}
          {me?.kind === "admin" && (
            <Link href="/admin" className={navClass("admin")}>
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {me?.kind === "user" && (
            <>
              <span className="hidden sm:inline text-muted leading-tight">
                {me.name} · code <span className="text-ink font-mono">{me.loginCode}</span>
              </span>
              <span className="pill bg-accent/15 text-accent normal-case tracking-normal">
                {me.chips.toLocaleString()} chips
              </span>
              <button onClick={logout} className="btn">
                Sign out
              </button>
            </>
          )}
          {me?.kind === "admin" && (
            <>
              <span className="hidden sm:inline text-muted">admin: {me.username}</span>
              <button onClick={logout} className="btn">
                Sign out
              </button>
            </>
          )}
          {!me && (
            <Link href="/admin/login" className="text-muted hover:text-ink">
              Admin
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
