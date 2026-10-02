# BUG-001: The 6-ticket limit was only enforced in the browser

| Field | Value |
| --- | --- |
| Severity | High (business rule bypassable, enables ticket scalping) |
| Priority | P1 |
| Component | `POST /api/orders` |
| Found by | `tests/specs/api-rules.spec.ts` |
| Status | **Fixed**, guarded by boundary tests at 6, 7 and 50 tickets |

## Summary

The event page stops you at 6 tickets per order: the `+` button disables at 6, and typing a bigger number is corrected back to 6. The API behind it had no such limit. Anyone who sent the request directly (browser dev tools, curl, a script) could buy as many tickets as were left, in a single order.

For a ticketing site that's the classic scalping hole: a bot can take a whole show's tickets in one request.

## Steps to reproduce (before the fix)

1. Log in as any user.
2. Open the browser dev tools and run:

```js
await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ eventId: 'e-synth-summer', quantity: 50 }),
}).then((r) => r.status);
```

## Expected result

`400 Bad Request`, with a message saying 1 to 6 tickets can be bought per order. Same rule as the UI.

## Actual result (before the fix)

`201 Created`. The order for 50 tickets went through and 50 tickets were taken off sale.

## Root cause

The limit already existed on the server (`MAX_TICKETS_PER_ORDER` in `app/server/db.ts`). It was sent to the browser through `GET /api/config` so the UI could show it, but `POST /api/orders` never checked it. The quantity validation only rejected values below 1.

## Fix

`POST /api/orders` in `app/server/api.ts` now checks the upper bound too:

```ts
if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
  throw new ApiError(400, 'VALIDATION_ERROR', `You can buy between 1 and ${MAX_TICKETS_PER_ORDER} tickets per order`);
}
```

The UI and the API now read the limit from the same constant, so they can't drift apart again.

## Verification

| Request | Before | After |
| --- | --- | --- |
| 6 tickets | `201` | `201` |
| 7 tickets | `201` | `400`, no tickets taken off sale |
| 50 tickets | `201` | `400`, no tickets taken off sale |

I ran the new tests against the old code first, and the 7- and 50-ticket cases failed as expected. With the fix, the whole suite passes.

## Why the UI tests didn't catch it

They couldn't. Every UI test for quantity limits passed, because the UI did its job. Any rule that matters has to be tested where it's enforced, not just where it's displayed, and that's why `api-rules.spec.ts` exists.

## Open question for the product owner

The limit is per order. Someone could still place several orders of 6. A per-customer limit per event would close that, but it's a product decision, so I've raised it rather than built it.
