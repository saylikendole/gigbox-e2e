import type { Locator, Page } from '@playwright/test';

/** The site header is on every logged-in page, so it's a component, not a page. */
export class Header {
  readonly userName: Locator;
  readonly logoutButton: Locator;
  readonly eventsLink: Locator;
  readonly ordersLink: Locator;

  constructor(page: Page) {
    const header = page.locator('#site-header');
    this.userName = header.getByTestId('user-name');
    this.logoutButton = header.getByRole('button', { name: 'Log out' });
    this.eventsLink = header.getByRole('link', { name: 'Events' });
    this.ordersLink = header.getByRole('link', { name: 'My orders' });
  }
}
