import { test as base, expect } from '@playwright/test';
import { ConfirmationPage, OrdersPage } from './pages/OrdersPage';
import { EventPage } from './pages/EventPage';
import { EventsPage } from './pages/EventsPage';
import { Header } from './pages/Header';
import { LoginPage } from './pages/LoginPage';
import { TestData, type TestUser } from './support/test-data';

type Fixtures = {
  loginPage: LoginPage;
  eventsPage: EventsPage;
  eventPage: EventPage;
  ordersPage: OrdersPage;
  confirmationPage: ConfirmationPage;
  header: Header;
  testData: TestData;
  /**
   * A brand-new user, already logged in inside this test's browser context.
   * Login happens through the API (page.request shares the browser's cookies),
   * which takes milliseconds instead of a UI round trip.
   */
  freshUser: TestUser;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  eventsPage: async ({ page }, use) => use(new EventsPage(page)),
  eventPage: async ({ page }, use) => use(new EventPage(page)),
  ordersPage: async ({ page }, use) => use(new OrdersPage(page)),
  confirmationPage: async ({ page }, use) => use(new ConfirmationPage(page)),
  header: async ({ page }, use) => use(new Header(page)),

  testData: async ({ playwright, baseURL }, use) => {
    // Its own request context, so test-data calls never touch the browser's session cookie
    const ctx = await playwright.request.newContext({ baseURL });
    await use(new TestData(ctx));
    await ctx.dispose();
  },

  freshUser: async ({ page, testData }, use) => {
    await page.context().clearCookies();
    const user = await testData.createUser();
    const res = await page.request.post('/api/auth/login', { data: { email: user.email, password: user.password } });
    expect(res.ok(), 'API login for fresh user').toBe(true);
    await use(user);
  },
});

export { expect };

export const SEEDED_USER = { name: 'Maya Jensen', email: 'maya@gigbox.test', password: 'Gigbox#2026' } as const;
export const LOGGED_OUT = { cookies: [], origins: [] };
