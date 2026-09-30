# BUG-001: The 6-ticket limit is only enforced in the browser

| Field | Value |
| --- | --- |
| Severity | High (business rule bypassable, enables ticket scalping) |
| Priority | P1 |
| Component | `POST /api/orders` |
| Found by | `tests/specs/api-rules.spec.ts` |
| Status | Open, documented in the suite with `test.fail()` |

## Summary

The event page stops you at 6 tickets per order: the `+` button disables at 6, and typing a bigger number is corrected back to 6. The API behind it has no such limit. Anyone who sends the request directly (browser dev tools, curl, a script) can buy as many tickets as are left, in a single order.

For a ticketing site this is the classic scalping hole: a bot can take a whole show's tickets in one request.

## Steps to reproduce

1. Log in as any user.
2. Open the browser dev tools and run:

```js
await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ eventId: 'e-synth-summer', quantity: 50 }),
}).then((r) => r.status);
```

Or run the automated check:

```bash
npx playwright test tests/specs/api-rules.spec.ts --project=chromium
```

## Expected result

`400 Bad Request`, with a message saying at most 6 tickets can be bought per order. Same rule as the UI.

## Actual result

`201 Created`. The order for 50 tickets goes through and 50 tickets are taken off sale.

## Root cause

The limit exists on the server (`MAX_TICKETS_PER_ORDER` in `app/server/db.ts`). It's published to the client through `GET /api/config` so the UI can show it, but `POST /api/orders` in `app/server/api.ts` never checks it. The quantity validation only rejects values below 1.

## Suggested fix

Add the upper bound to the existing quantity check in `POST /api/orders`:

```ts
if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
  throw new ApiError(400, 'VALIDATION_ERROR', `You can buy between 1 and ${MAX_TICKETS_PER_ORDER} tickets per order`);
}
```

A per-user limit per event would be worth discussing with the product owner too, since several orders of 6 would still get around this.

## How we'll know it's fixed

The test is marked `test.fail()`, so it passes while the bug exists. Once the API is fixed, the test starts passing for real, Playwright reports that as an unexpected pass, and that's the signal to remove `test.fail()` and close this bug.

## Why the UI tests didn't catch it

They couldn't. Every UI test for quantity limits passes, because the UI does its job. This is why `api-rules.spec.ts` exists: any rule that matters has to be checked where it's enforced, not just where it's displayed.
