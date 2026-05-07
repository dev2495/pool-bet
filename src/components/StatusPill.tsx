import clsx from "@/lib/clsx";

const palette: Record<string, string> = {
  DRAFT: "bg-line text-muted",
  OPEN: "bg-warn/20 text-warn",
  LIVE: "bg-accent/20 text-accent",
  CLOSED: "bg-line text-ink",
  SETTLED: "bg-win/20 text-win",
  PENDING: "bg-line text-muted",
  VOID: "bg-loss/20 text-loss",
  ACTIVE: "bg-accent/20 text-accent",
  WON: "bg-win/20 text-win",
  LOST: "bg-loss/20 text-loss",
  REFUNDED: "bg-warn/20 text-warn",
};

export default function StatusPill({ status }: { status: string }) {
  return <span className={clsx("pill", palette[status] || "bg-line text-muted")}>{status}</span>;
}
