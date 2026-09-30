import type { Locator, Page } from '@playwright/test';

export class EventsPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly city: Locator;
  readonly category: Locator;
  readonly results: Locator;
  readonly cards: Locator;
  readonly resultCount: Locator;
  readonly emptyState: Locator;
  readonly clearFilters: Locator;
  readonly loadError: Locator;
  readonly retry: Locator;
  readonly loading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: "What's on" });
    this.search = page.getByRole('searchbox', { name: 'Search' });
    this.city = page.getByLabel('City');
    this.category = page.getByLabel('Category');
    this.results = page.getByRole('list', { name: 'Events' });
    this.cards = this.results.getByRole('article');
    this.resultCount = page.locator('#result-count');
    this.emptyState = page.getByRole('heading', { name: 'No events match your search' });
    this.clearFilters = page.getByRole('button', { name: 'Clear filters' });
    this.loadError = page.getByRole('alert').filter({ hasText: "couldn't load events" });
    this.retry = page.getByRole('button', { name: 'Try again' });
    this.loading = page.locator('[aria-busy="true"]');
  }

  async goto() {
    await this.page.goto('/');
    await this.heading.waitFor();
  }

  card(eventName: string): Locator {
    return this.cards.filter({ has: this.page.getByRole('heading', { name: eventName, exact: true }) });
  }

  /**
   * Filtering triggers a debounced API call. Waiting for that response means
   * assertions never run against the previous, stale list.
   */
  private async afterSearch(action: () => Promise<unknown>) {
    const response = this.page.waitForResponse((r) => r.url().includes('/api/events') && r.request().method() === 'GET');
    await action();
    await response;
  }

  searchFor(text: string) {
    return this.afterSearch(() => this.search.fill(text));
  }

  filterByCity(city: string) {
    return this.afterSearch(() => this.city.selectOption(city));
  }

  filterByCategory(category: string) {
    return this.afterSearch(() => this.category.selectOption(category));
  }

  async open(eventName: string) {
    await this.card(eventName).getByRole('link', { name: eventName }).click();
  }
}
