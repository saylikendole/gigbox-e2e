import { test, expect } from '../fixtures';
import { expectedPrice } from '../support/pricing';

/**
 * UI tests show what a user can do in the browser. These check that the
 * server enforces the same rules, because anyone can skip the UI and call
 * the API directly (browser dev tools, curl, a script).
 */
test.describe('Business rules are enforced by the server, not just the UI', () => {
  test.beforeEach(async ({ freshUser }) => {
    expect(freshUser.id).toBeTruthy();
  });

  /**
   * Regression guard for BUG-001 (fixed), see docs/bugs/BUG-001-ticket-limit-not-enforced.md
   * The UI capped orders at 6 tickets but the API accepted any quantity.
   * Boundary values around the limit: 6 is the last valid value, 7 the first invalid one.
   */
  for (const [quantity, expected] of [
    [6, 201],
    [7, 400],
    [50, 400],
  ] as const) {
    test(`an order for ${quantity} tickets sent straight to the API → ${expected} @security`, async ({ page, testData }) => {
      test.info().annotations.push({ type: 'regression', description: 'BUG-001: ticket limit only enforced in the browser (fixed)' });
      const event = await testData.createEvent({ capacity: 500 });

      const res = await page.request.post('/api/orders', { data: { eventId: event.id, quantity } });

      expect(res.status()).toBe(expected);
      if (expected === 400) {
        expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
        // A rejected order must not take tickets off sale
        expect((await testData.getEvent(event.id)).remaining).toBe(500);
      }
    });
  }

  test('the client cannot set its own price @security', async ({ page, testData }) => {
    const event = await testData.createEvent({ priceCents: 50000 });

    const res = await page.request.post('/api/orders', {
      data: { eventId: event.id, quantity: 2, unitPriceCents: 1, totalCents: 1, discountCents: 99999 },
    });

    expect(res.status()).toBe(201);
    const order = await res.json();
    expect(order.totalCents).toBe(expectedPrice({ priceCents: 50000, quantity: 2 }).total);
  });

  test('an expired promo code is rejected at checkout even if the UI is bypassed @security', async ({ page, testData }) => {
    const event = await testData.createEvent();
    const res = await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 1, promoCode: 'SUMMER25' } });
    expect(res.status()).toBe(422);
    expect((await res.json()).error.code).toBe('PROMO_EXPIRED');
  });

  test("a user cannot read someone else's order by guessing its ID @security", async ({ page, playwright, baseURL, testData }) => {
    const event = await testData.createEvent();
    const mine = await (await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 1 } })).json();

    const other = await testData.createUser();
    const otherCtx = await playwright.request.newContext({ baseURL });
    await otherCtx.post('/api/auth/login', { data: { email: other.email, password: other.password } });

    const res = await otherCtx.get(`/api/orders/${mine.id}`);
    expect(res.status()).toBe(404);
    await otherCtx.dispose();
  });

  test('buying more tickets than are left is refused @regression', async ({ page, testData }) => {
    const event = await testData.createEvent({ capacity: 10, sold: 8 });
    const res = await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 3 } });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe('NOT_ENOUGH_TICKETS');
  });
});
