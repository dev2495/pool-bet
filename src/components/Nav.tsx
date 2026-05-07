"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Me =
  | { kind: "user"; id: string; name: string; chips: number; loginCode: string }
  | { kind: "admin"; username: string }
  | null;

type Active = "play" | "history" | "admin" | "users" | "ledger";

export default function Nav({ active }: { active?: Active }) {
  const [me, setMe] = useState<Me>(null);
  const pathname = usePathname();

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

  const current: Active | undefined =
    active ||
    (pathname.startsWith("/history")
      ? "history"
      : pathname.startsWith("/admin/users")
      ? "users"
      : pathname.startsWith("/admin/ledger")
      ? "ledger"
      : pathname.startsWith("/admin")
      ? "admin"
      : pathname.startsWith("/play")
      ? "play"
      : undefined);

  const navClass = (key: Active) =>
    "rounded-md px-2.5 py-2 transition " +
    (current === key ? "bg-panel2 text-ink shadow-sm" : "text-muted hover:bg-panel2/70 hover:text-ink");

  const bottomClass = (key: Active) =>
    "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] font-bold transition " +
    (current === key ? "bg-white text-accent shadow-sm" : "text-muted");

  return (
    <>
    <header className="sticky top-0 z-20 border-b border-line/80 bg-white/[0.82] backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-3 py-2.5 flex items-center gap-3 sm:px-4 sm:py-3">
        <Link href="/" className="font-bold text-ink flex items-center gap-2 tracking-tight">
          <span className="inline-block h-8 w-8 rounded-full bg-gradient-to-br from-[#0a5cc8] to-[#073b83] shadow-sm" />
          Pool&#8209;Bet
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-semibold sm:flex">
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
            <>
              <Link href="/admin" className={navClass("admin")}>
                Dashboard
              </Link>
              <Link href="/admin/users" className={navClass("users")}>
                Players
              </Link>
              <Link href="/admin/ledger" className={navClass("ledger")}>
                Ledger
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {me?.kind === "user" && (
            <>
              <span className="hidden sm:inline text-muted leading-tight">
                {me.name} · code <span className="text-ink font-mono">{me.loginCode}</span>
              </span>
              <span className="pill bg-panel2 text-ink normal-case tracking-normal">
                {me.chips.toLocaleString()} chips
              </span>
              <button onClick={logout} className="btn hidden sm:inline-flex">
                Sign out
              </button>
            </>
          )}
          {me?.kind === "admin" && (
            <>
              <span className="hidden sm:inline text-muted">admin: {me.username}</span>
              <button onClick={logout} className="btn hidden sm:inline-flex">
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
    {(me?.kind === "user" || me?.kind === "admin") && (
      <nav className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-lg rounded-lg glass-rail safe-bottom sm:hidden">
        <div className="flex gap-1 p-1.5">
          {me.kind === "user" ? (
            <>
              <Link href="/play" className={bottomClass("play")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Play
              </Link>
              <Link href="/history" className={bottomClass("history")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                History
              </Link>
              <button onClick={logout} className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] font-bold text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/admin" className={bottomClass("admin")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Dashboard
              </Link>
              <Link href="/admin/users" className={bottomClass("users")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Players
              </Link>
              <Link href="/admin/ledger" className={bottomClass("ledger")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Ledger
              </Link>
              <button onClick={logout} className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] font-bold text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Out
              </button>
            </>
          )}
        </div>
      </nav>
    )}
    </>
  );
}
