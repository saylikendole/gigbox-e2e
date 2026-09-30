import { test, expect } from '../fixtures';

/**
 * These tests read the seeded catalogue and never buy anything, so they can
 * safely share the logged-in session saved by the setup project.
 */
test.describe('Browsing events', () => {
  test.beforeEach(async ({ eventsPage }) => {
    await eventsPage.goto();
  });

  test('shows upcoming events with the key details @smoke', async ({ eventsPage }) => {
    const card = eventsPage.card('Northern Lights Tour');

    await expect(card).toContainText('Aurora Bay');
    await expect(card).toContainText('Vega, Copenhagen');
    await expect(card).toContainText('From €425.00');
    await expect(eventsPage.resultCount).toHaveText(/\d+ events/);
  });

  test('events are listed soonest first @regression', async ({ eventsPage }) => {
    const times = await eventsPage.cards.locator('time').evaluateAll((els) => els.map((el) => el.getAttribute('datetime')!));
    expect(times.length).toBeGreaterThan(1);
    expect(times).toEqual([...times].sort());
  });

  test('searching by artist narrows the list @smoke', async ({ eventsPage }) => {
    await eventsPage.searchFor('Lina Holm');

    await expect(eventsPage.cards).toHaveCount(1);
    await expect(eventsPage.card('Jazz in the Cellar')).toBeVisible();
  });

  test('search matches venue names and ignores letter case @regression', async ({ eventsPage }) => {
    await eventsPage.searchFor('MONTMARTRE');
    await expect(eventsPage.card('Jazz in the Cellar')).toBeVisible();
  });

  test('city and category filters combine @regression', async ({ eventsPage }) => {
    await eventsPage.filterByCity('Copenhagen');
    await eventsPage.filterByCategory('Comedy');

    await expect(eventsPage.card('Open Mic Night')).toBeVisible();
    await expect(eventsPage.card('Late Laughs')).toBeHidden(); // Comedy, but in Aarhus
    await expect(eventsPage.card('Jazz in the Cellar')).toBeHidden(); // Copenhagen, but a Concert

    for (const card of await eventsPage.cards.all()) {
      await expect(card).toHaveAttribute('data-category', 'Comedy');
      await expect(card).toContainText('Copenhagen');
    }
  });

  test('a search with no matches shows a helpful empty state, and "Clear filters" resets it @regression', async ({ eventsPage }) => {
    await eventsPage.searchFor('zzz no such band');
    await expect(eventsPage.emptyState).toBeVisible();

    await eventsPage.clearFilters.click();
    await expect(eventsPage.search).toHaveValue('');
    await expect(eventsPage.card('Northern Lights Tour')).toBeVisible();
  });

  test('sold-out and nearly sold-out events are flagged @regression', async ({ eventsPage }) => {
    await expect(eventsPage.card('Hamlet (in English)')).toContainText('Sold out');
    await expect(eventsPage.card('Late Laughs')).toContainText('Only 3 left');
    await expect(eventsPage.card('Northern Lights Tour')).not.toContainText(/Sold out|left/);
  });

  test('opening an event shows its detail page @smoke', async ({ page, eventsPage, eventPage }) => {
    await eventsPage.open('Baltic Strings');

    await expect(page).toHaveURL(/\/event\?id=e-baltic-strings/);
    await expect(eventPage.heading).toHaveText('Baltic Strings');
  });
});
