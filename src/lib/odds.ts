// Pari-mutuel odds engine.
//
// For a match with outcomes O_1..O_n, let:
//   P = total chips wagered across the match
//   p_i = chips wagered on outcome i
//   r = rake fraction (e.g. 0.05 for 5%)
//
// Distributable pool = P * (1 - r)
// If outcome i wins, each chip on outcome i gets back: distributable / p_i
// (this is the "decimal odds" — includes the original stake).
//
// If p_i == 0 (no one bet on the winner), the pool refunds losers? No — by spec
// admin still picks a winner. In our system, if the winning side had zero stake
// the entire pool stays with the house (rake + losing-side stakes), and losing
// stakes do NOT come back. We default this to a refund-everyone fallback to be
// kinder; admins can also VOID a match, which refunds all stakes.

export type OutcomeView = {
  id: string;
  label: string;
  poolChips: number;
  betCount: number;
  // decimal odds — multiplier applied to a winning stake to get gross payout.
  // Equals (totalPool * (1 - rake)) / poolChips, or null when undefined (zero stakes).
  oddsDecimal: number | null;
  // share of the pool, 0..1
  share: number;
};

export type MatchView = {
  totalPool: number;
  rakeBps: number;
  outcomes: OutcomeView[];
};

export function computeOdds(
  outcomes: { id: string; label: string; poolChips: number; betCount: number }[],
  rakeBps: number
): MatchView {
  const totalPool = outcomes.reduce((s, o) => s + o.poolChips, 0);
  const r = clamp(rakeBps, 0, 9999) / 10000;
  const distributable = totalPool * (1 - r);

  const view: OutcomeView[] = outcomes.map((o) => {
    let oddsDecimal: number | null = null;
    if (o.poolChips > 0 && distributable > 0) {
      oddsDecimal = distributable / o.poolChips;
    }
    const share = totalPool > 0 ? o.poolChips / totalPool : 0;
    return {
      id: o.id,
      label: o.label,
      poolChips: o.poolChips,
      betCount: o.betCount,
      oddsDecimal,
      share,
    };
  });

  return { totalPool, rakeBps, outcomes: view };
}

// Compute payouts for every active bet on a match given the winning outcome.
// Returns a list of { betId, userId, stake, payout } where payout includes
// the original stake for winners and 0 for losers. Floors to integer chips —
// any rounding dust is left in the pool (effectively additional rake).
export function computePayouts(args: {
  bets: { id: string; userId: string; outcomeId: string; stake: number }[];
  winningOutcomeId: string;
  rakeBps: number;
}): { betId: string; userId: string; stake: number; payout: number; won: boolean }[] {
  const { bets, winningOutcomeId, rakeBps } = args;
  const totalPool = bets.reduce((s, b) => s + b.stake, 0);
  const winners = bets.filter((b) => b.outcomeId === winningOutcomeId);
  const winningPool = winners.reduce((s, b) => s + b.stake, 0);
  const r = clamp(rakeBps, 0, 9999) / 10000;
  const distributable = totalPool * (1 - r);

  // Edge case: no one bet on the winner. Refund every bet (treat as void).
  if (winningPool === 0) {
    return bets.map((b) => ({
      betId: b.id,
      userId: b.userId,
      stake: b.stake,
      payout: b.stake,
      won: false,
    }));
  }

  const ratio = distributable / winningPool;
  return bets.map((b) => {
    if (b.outcomeId === winningOutcomeId) {
      const payout = Math.floor(b.stake * ratio);
      return { betId: b.id, userId: b.userId, stake: b.stake, payout, won: true };
    }
    return { betId: b.id, userId: b.userId, stake: b.stake, payout: 0, won: false };
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
