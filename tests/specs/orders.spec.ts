import { test, expect } from '../fixtures';
import { eur, expectedPrice } from '../support/pricing';

test.describe('My orders', () => {
  // Every test runs as a brand-new user, so the order list only contains what the test itself created
  test.beforeEach(async ({ freshUser }) => {
    expect(freshUser.id).toBeTruthy();
  });

  test('a new user sees an empty state with a way back to events @regression', async ({ ordersPage, page }) => {
    await ordersPage.goto();

    await expect(ordersPage.emptyState).toBeVisible();
    await page.getByRole('link', { name: 'Browse events' }).click();
    await expect(page).toHaveURL('/');
  });

  test('users only see their own orders @security', async ({ testData, ordersPage }) => {
    const event = await testData.createEvent();
    await testData.buyAsSomeoneElse(event.id, 2);

    await ordersPage.goto();
    await expect(ordersPage.emptyState).toBeVisible();
  });

  test.describe('cancelling', () => {
    test('an order more than 48 hours away can be cancelled for a full refund @smoke', async ({
      page,
      testData,
      ordersPage,
    }) => {
      const event = await testData.createEvent({ priceCents: 22000, hoursAhead: 24 * 10, capacity: 100, sold: 50 });
      await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 2 } });
      const refund = eur(expectedPrice({ priceCents: 22000, quantity: 2 }).total);
  
      await ordersPage.goto();
      await ordersPage.cancelButton(event.name).click();

      await expect(ordersPage.dialog).toBeVisible();
      await expect(ordersPage.dialogText).toContainText(`full refund of ${refund}`);
      await ordersPage.confirmCancel.click();

      await expect(ordersPage.toast).toHaveText(`Order cancelled. ${refund} will be refunded to your card.`);
      await expect(ordersPage.order(event.name)).toContainText('Cancelled');
      await expect(ordersPage.cancelButton(event.name)).toBeHidden();

      // The 2 tickets go back on sale
      expect((await testData.getEvent(event.id)).remaining).toBe(50); // back to where it was before the purchase
    });

    test('"Keep my tickets" closes the dialog and changes nothing @regression', async ({ page, testData, ordersPage }) => {
        const event = await testData.createEvent({ hoursAhead: 24 * 10 });
      await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 1 } });

      await ordersPage.goto();
      await ordersPage.cancelButton(event.name).click();
      await ordersPage.keepTickets.click();

      await expect(ordersPage.dialog).toBeHidden();
      await expect(ordersPage.order(event.name)).toContainText('Confirmed');
    });

    // Boundary around the 48-hour rule. The exact 48h mark is left out on
    // purpose: the few seconds between setup and check would make it flaky.
    for (const [hoursAhead, cancellable] of [
      [49, true],
      [47, false],
      [2, false],
    ] as const) {
      test(`an event ${hoursAhead} hours away ${cancellable ? 'can' : 'cannot'} be cancelled @regression`, async ({
        page,
        testData,
        ordersPage,
      }) => {
            const event = await testData.createEvent({ hoursAhead });
        await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 1 } });

        await ordersPage.goto();
        const order = ordersPage.order(event.name);

        if (cancellable) {
          await expect(ordersPage.cancelButton(event.name)).toBeEnabled();
        } else {
          await expect(ordersPage.cancelButton(event.name)).toBeHidden();
          await expect(order).toContainText('Cancellation closes 48 hours before the event.');
        }
      });
    }

    test('the API also refuses a late cancellation, not just the UI @security', async ({ page, testData }) => {
        const event = await testData.createEvent({ hoursAhead: 10 });
      const order = await (await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 1 } })).json();

      const res = await page.request.post(`/api/orders/${order.id}/cancel`);
      expect(res.status()).toBe(422);
      expect((await res.json()).error.code).toBe('CANCELLATION_CLOSED');
    });
  });
});
