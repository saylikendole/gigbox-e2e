import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, LOGGED_OUT } from '../fixtures';

/** Scan for WCAG 2.1 A and AA violations. The failure message lists each rule and the elements that break it. */
async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`);
  expect(summary, 'accessibility violations').toEqual([]);
}

/** Press Tab until the element with this accessible name has focus. Fails if it's not reachable by keyboard. */
async function tabTo(page: Page, name: RegExp, maxTabs = 25) {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute('aria-label') ?? el?.innerText ?? '';
    });
    if (name.test(focused.trim())) return;
  }
  throw new Error(`Could not reach ${name} with the keyboard in ${maxTabs} tabs`);
}

test.describe('Accessibility', () => {
  test.describe('logged out', () => {
    test.use({ storageState: LOGGED_OUT });

    test('login page has no WCAG 2.1 AA violations @a11y', async ({ page, loginPage }) => {
      await loginPage.goto();
      await expectNoA11yViolations(page);
    });

    test('login error is announced to screen readers @a11y', async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.login('maya@gigbox.test', 'wrong');
      await expect(loginPage.error).toHaveAttribute('role', 'alert');
    });
  });

  test('events page has no WCAG 2.1 AA violations @a11y', async ({ page, eventsPage }) => {
    await eventsPage.goto();
    await expect(eventsPage.cards.first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('event page, including an applied promo code, has no WCAG 2.1 AA violations @a11y', async ({ page, eventPage }) => {
    await eventPage.goto('e-northern-lights');
    await eventPage.applyPromo('GIG10');
    await expect(eventPage.discount).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('orders page and the cancel dialog have no WCAG 2.1 AA violations @a11y', async ({ page, freshUser, testData, ordersPage }) => {
    expect(freshUser.id).toBeTruthy();
    const event = await testData.createEvent({ hoursAhead: 24 * 10 });
    await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 1 } });

    await ordersPage.goto();
    await expectNoA11yViolations(page);

    await ordersPage.cancelButton(event.name).click();
    await expect(ordersPage.dialog).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('tickets can be bought using only the keyboard @a11y', async ({ page, freshUser, testData, eventPage }) => {
    expect(freshUser.id).toBeTruthy();
    const event = await testData.createEvent();
    await eventPage.goto(event.id);

    await tabTo(page, /^Add one ticket$/);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(eventPage.quantity).toHaveValue('3');

    await tabTo(page, /^Buy 3 tickets$/);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: "You're going!" })).toBeVisible();
  });

  test('the cancel dialog traps focus and closes with Escape @a11y', async ({ page, freshUser, testData, ordersPage }) => {
    expect(freshUser.id).toBeTruthy();
    const event = await testData.createEvent({ hoursAhead: 24 * 10 });
    await page.request.post('/api/orders', { data: { eventId: event.id, quantity: 1 } });
    await ordersPage.goto();

    await ordersPage.cancelButton(event.name).click();
    // Focus moves into the dialog when it opens
    await expect(ordersPage.keepTickets).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(ordersPage.dialog).toBeHidden();
    await expect(ordersPage.order(event.name)).toContainText('Confirmed');
  });
});
