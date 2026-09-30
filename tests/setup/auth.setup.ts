import { test as setup, expect, SEEDED_USER } from '../fixtures';

export const STORAGE_STATE = '.auth/maya.json';

/**
 * Runs once before the browser projects: resets the app's data, logs in
 * through the real login form, and saves the session. Tests that only need
 * "a logged-in user" reuse that session instead of logging in again.
 */
setup('reset data and log in once', async ({ page, loginPage, testData }) => {
  await testData.reset();

  await loginPage.goto();
  await loginPage.login(SEEDED_USER.email, SEEDED_USER.password);
  await expect(page.getByRole('heading', { name: "What's on" })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
