import { test, expect } from '../fixtures';

/** Matches the events list request with or without a query string. */
const EVENTS_API = (url: URL) => url.pathname === '/api/events';

/**
 * Network mocking: force the failures that are hard to produce against a
 * real backend (500s, timeouts, dropped connections) and check that the UI
 * handles them the way a user would expect.
 */
test.describe('Resilience when the backend misbehaves', () => {
  test('if events fail to load, the user sees an error and can retry @regression', async ({ page, eventsPage }) => {
    // Fail only the first request; the retry reaches the real server
    await page.route(EVENTS_API, (route) => route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'boom' } } }), {
      times: 1,
    });

    await page.goto('/');
    await expect(eventsPage.loadError).toBeVisible();

    await eventsPage.retry.click();
    await expect(eventsPage.card('Northern Lights Tour')).toBeVisible();
    await expect(eventsPage.loadError).toBeHidden();
  });

  test('a slow response shows a loading state instead of a blank page @regression', async ({ page, eventsPage }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(EVENTS_API, async (route) => {
      await gate; // hold the response until the test has checked the loading state
      await route.continue();
    });

    await page.goto('/');
    await expect(eventsPage.loading).toBeVisible();
    await expect(eventsPage.resultCount).toHaveText('Loading events…');

    release();
    await expect(eventsPage.cards.first()).toBeVisible();
    await expect(eventsPage.loading).toBeHidden();
  });

  test('an empty catalogue shows the empty state @regression', async ({ page, eventsPage }) => {
    await page.route(EVENTS_API, (route) => route.fulfill({ json: { items: [] } }));
    await page.goto('/');
    await expect(eventsPage.emptyState).toBeVisible();
  });

  test('if the connection drops while paying, the user is told they were not charged and can retry @regression', async ({
    page,
    freshUser,
    testData,
    eventPage,
  }) => {
    expect(freshUser.id).toBeTruthy();
    const event = await testData.createEvent();
    await eventPage.goto(event.id);

    await page.route((url) => url.pathname === '/api/orders', (route) => route.abort('connectionreset'), { times: 1 });
    await eventPage.buy();

    await expect(eventPage.buyError).toHaveText('Something went wrong and you have not been charged. Please try again.');
    await expect(eventPage.buyButton).toBeEnabled();

    // Second attempt goes through normally
    await eventPage.buy();
    await expect(page.getByRole('heading', { name: "You're going!" })).toBeVisible();
  });

  test('event data with HTML in it is shown as text, never run as code (XSS) @security', async ({ page, eventsPage }) => {
    const payload = '<img src=x onerror="window.__xss=true">';
    await page.route(EVENTS_API, (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'e-xss', name: payload, artist: payload, category: 'Concert', city: 'Copenhagen', venue: 'Somewhere',
              startsAt: new Date(Date.now() + 86_400_000).toISOString(), priceCents: 1000, capacity: 10, sold: 0, remaining: 10, soldOut: false,
            },
          ],
        },
      }),
    );

    await page.goto('/');
    await expect(eventsPage.cards.first()).toContainText(payload);
    expect(await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)).toBeUndefined();
  });
});
