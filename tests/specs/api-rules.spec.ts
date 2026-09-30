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
   * Known defect, see docs/bugs/BUG-001-ticket-limit-not-enforced.md
   *
   * test.fail() means: this test is EXPECTED to fail while the bug exists.
   * When someone fixes the API, the test starts passing, Playwright reports
   * that as an error, and that's the reminder to remove the marker and
   * close the bug.
   */
  test('the 6-ticket limit per order is enforced by the API @security', async ({ page, testData }) => {
    test.info().annotations.push({ type: 'issue', description: 'BUG-001: ticket limit only enforced in the browser' });
    test.fail();

    const event = await testData.createEvent({ capacity: 500 });
    const res = await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 50 } });

    expect(res.status(), 'an order for 50 tickets should be rejected').toBe(400);
  });

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
