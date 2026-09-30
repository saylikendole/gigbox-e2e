# Test strategy

The thinking behind this suite: what's covered, how, and what's deliberately left out.

## What matters most in a ticketing app

Ranked by the damage a bug would do:

1. **People can buy tickets, and pay the right amount.** A broken checkout or a wrong total costs money and trust immediately.
2. **Stock is correct.** Overselling a sold-out show is worse than a crash.
3. **Rules can't be bypassed.** Ticket limits, promo expiry and cancellation windows have to hold even when someone skips the UI.
4. **Failures are handled gracefully.** Networks drop and servers have bad moments. The user should always know what happened and whether they were charged.
5. **Everyone can use it.** Accessibility is a legal requirement in the EU (European Accessibility Act), and keyboard and screen-reader users buy tickets too.

## Levels

| Level | What it covers | Where |
| --- | --- | --- |
| End-to-end UI | Real user journeys through the browser | `login`, `events`, `purchase`, `orders` specs |
| UI with mocked network | Error, loading and empty states that are hard to trigger for real | `resilience.spec.ts` |
| Accessibility | axe-core WCAG 2.1 AA scans and keyboard-only flows | `accessibility.spec.ts` |
| API rules | The server enforces what the UI shows | `api-rules.spec.ts` |

Most tests are UI tests on purpose, because that's what this repo demonstrates. In a real team I'd push most business-rule checks down to API or unit level and keep UI tests for the journeys that matter most. My [Roomly API suite](https://github.com/saylikendole/roomly-api-quality) shows that side.

## Test design techniques

- **Boundary values:** quantity 0/1/6/10, typed decimals and negatives, 47/49 hours before the event for the cancellation rule, only 3 tickets left.
- **Equivalence partitioning:** promo codes split into valid, unknown and expired.
- **State-based testing:** available, low stock, sold out, and "sold out while you were looking".
- **Independent oracle for money:** `tests/support/pricing.ts` calculates the expected total from the business rules. Tests compare the UI against that, never against numbers copied from the UI.
- **Risk-based cross-browser coverage:** the full suite runs on Chromium. Only `@smoke` tests run on Firefox and a Pixel 7 viewport, because running everything three times costs a lot and rarely finds more.

## Data and isolation

- **Seeded catalogue for read-only tests.** Browsing tests use the seeded events and never buy anything, so their expectations ("Only 3 left", "Sold out") stay true.
- **Fresh data for anything that changes state.** Purchase and order tests create their own event and their own user through test-only endpoints. No test can change another test's stock or order list.
- **Log in once, reuse the session.** A setup project logs in through the real form and saves the session. Tests that need a fresh user log in through the API instead (milliseconds instead of a UI round trip).
- **The login form itself is still tested** in `login.spec.ts`, including redirects and open-redirect protection.

## Flakiness policy

- Locators use roles and labels the way a user would find things (`getByRole('button', { name: 'Buy 2 tickets' })`), with `data-testid` only for values that have no accessible name, like price cells.
- No fixed waits (`waitForTimeout`) anywhere. Search waits for the actual API response, so assertions never run against the previous list.
- The 48-hour boundary tests avoid the exact 48:00 mark, since the few seconds between setup and check would make that test flaky.
- On CI, one retry with a trace. A test that needs its retry shows as "flaky" in the report, so it gets investigated rather than hidden. Locally, retries are off.
- Before publishing, the suite was run three times in a row with retries off: all runs passed.

## Known bugs

Known bugs stay in the suite, marked `test.fail()` and linked to a written report. The suite stays green, the bug stays visible, and a fix is detected automatically. See [BUG-001](bugs/BUG-001-ticket-limit-not-enforced.md).

The suite also found a real defect while it was being written: when another customer bought the last tickets first, the "tickets just sold" message had nowhere to render. That was fixed in the app (see the git history).

## Out of scope (and what I'd add next)

- **Visual regression screenshots.** Pixel comparisons depend on the OS and fonts, so they need a fixed Docker image to be reliable. That would be the next step.
- **Payment provider integration.** Checkout here has no card step. With a real provider I'd test against its sandbox and mock it in most UI tests.
- **Load testing.** Covered in the Roomly repo with k6.
- **Email confirmations.** Would need a mail catcher (e.g. Mailpit) in CI.
