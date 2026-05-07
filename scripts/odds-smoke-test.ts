// Quick check of pari-mutuel math. Run with: npx tsx scripts/odds-smoke-test.ts
import { computeOdds, computePayouts } from "../src/lib/odds";

function near(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

// Scenario A: 3-outcome match. 100 chips on A, 200 on B, 50 on C. 5% rake.
{
  const view = computeOdds(
    [
      { id: "a", label: "A", poolChips: 100, betCount: 1 },
      { id: "b", label: "B", poolChips: 200, betCount: 2 },
      { id: "c", label: "C", poolChips: 50, betCount: 1 },
    ],
    500
  );
  check("A: total pool", view.totalPool === 350);
  // distributable = 350 * 0.95 = 332.5
  // odds A = 332.5 / 100 = 3.325
  // odds B = 332.5 / 200 = 1.6625
  // odds C = 332.5 / 50 = 6.65
  check("A: odds A", near(view.outcomes[0].oddsDecimal!, 3.325));
  check("A: odds B", near(view.outcomes[1].oddsDecimal!, 1.6625));
  check("A: odds C", near(view.outcomes[2].oddsDecimal!, 6.65));
}

// Scenario B: zero-sum guarantee. Total payouts <= total pool.
{
  const bets = [
    { id: "1", userId: "u1", outcomeId: "a", stake: 100 },
    { id: "2", userId: "u2", outcomeId: "b", stake: 200 },
    { id: "3", userId: "u3", outcomeId: "a", stake: 50 },
  ];
  const totalPool = bets.reduce((s, b) => s + b.stake, 0);
  // A wins. A pool = 150. distributable = 350 * 0.95 = 332.5. ratio = 332.5/150 ≈ 2.21666
  // u1 stake 100 -> 221, u3 stake 50 -> 110. Total paid = 331 (one chip dust).
  const payouts = computePayouts({ bets, winningOutcomeId: "a", rakeBps: 500 });
  const totalPaid = payouts.reduce((s, p) => s + p.payout, 0);
  check("B: total paid <= pool minus rake", totalPaid <= Math.floor(totalPool * 0.95));
  check("B: u1 wins ~221", payouts.find((p) => p.userId === "u1")!.payout === 221);
  check("B: u2 loses 0", payouts.find((p) => p.userId === "u2")!.payout === 0);
  check("B: u3 wins ~110", payouts.find((p) => p.userId === "u3")!.payout === 110);
}

// Scenario C: nobody bet on the winner -> refund all (treat as void).
{
  const bets = [
    { id: "1", userId: "u1", outcomeId: "a", stake: 100 },
    { id: "2", userId: "u2", outcomeId: "b", stake: 200 },
  ];
  const payouts = computePayouts({ bets, winningOutcomeId: "c", rakeBps: 500 });
  const refunded = payouts.every((p) => p.payout === p.stake && !p.won);
  check("C: refund all when winner has no stakes", refunded);
}

// Scenario D: rake = 0 means perfect zero-sum (winners get every chip the losers staked).
{
  const bets = [
    { id: "1", userId: "u1", outcomeId: "a", stake: 100 },
    { id: "2", userId: "u2", outcomeId: "b", stake: 200 },
    { id: "3", userId: "u3", outcomeId: "a", stake: 50 },
  ];
  const payouts = computePayouts({ bets, winningOutcomeId: "a", rakeBps: 0 });
  const totalPaid = payouts.reduce((s, p) => s + p.payout, 0);
  // Without rake: winners share all 350 chips (their stake + 200 from losers).
  // ratio = 350/150 = 2.333... -> 233 + 116 = 349 (one chip dust)
  check("D: no-rake total ~ pool", totalPaid >= 348 && totalPaid <= 350);
}

// Scenario E: equal stake on every outcome -> odds equal & = (1 - rake) * n.
{
  const view = computeOdds(
    [
      { id: "a", label: "A", poolChips: 100, betCount: 1 },
      { id: "b", label: "B", poolChips: 100, betCount: 1 },
      { id: "c", label: "C", poolChips: 100, betCount: 1 },
    ],
    500
  );
  // distributable = 300 * 0.95 = 285. each odds = 285/100 = 2.85.
  check("E: balanced book gives fair odds", view.outcomes.every((o) => near(o.oddsDecimal!, 2.85)));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
