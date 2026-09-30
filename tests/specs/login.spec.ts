import { test, expect, LOGGED_OUT, SEEDED_USER } from '../fixtures';

test.use({ storageState: LOGGED_OUT });

test.describe('Login', () => {
  test('a user can log in and lands on the events page @smoke', async ({ page, loginPage, header }) => {
    await loginPage.goto();
    await loginPage.login(SEEDED_USER.email, SEEDED_USER.password);

    await expect(page).toHaveURL('/');
    await expect(header.userName).toHaveText(SEEDED_USER.name);
  });

  test('a wrong password shows an error and keeps the user on the login page @regression', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(SEEDED_USER.email, 'not-the-password');

    await expect(loginPage.error).toHaveText('That email and password combination is not right.');
    await expect(page).toHaveURL(/\/login/);
  });

  test('submitting an empty form asks for both fields without calling the API @regression', async ({ page, loginPage }) => {
    let apiCalled = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/login')) apiCalled = true;
    });

    await loginPage.goto();
    await loginPage.submit.click();

    await expect(loginPage.error).toHaveText('Enter your email and password.');
    expect(apiCalled).toBe(false);
  });

  test('opening a protected page sends you to log in, then back where you were @regression', async ({ page, loginPage }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);

    await loginPage.login(SEEDED_USER.email, SEEDED_USER.password);
    await expect(page).toHaveURL('/orders');
  });

  test('the "next" parameter cannot redirect to another website (open redirect) @security', async ({ page, loginPage, baseURL }) => {
    await loginPage.goto('https://evil.example/phish');
    await loginPage.login(SEEDED_USER.email, SEEDED_USER.password);

    await expect(page).toHaveURL(`${baseURL}/`);
  });

  test('protocol-relative "next" (//evil.example) is also blocked @security', async ({ page, loginPage, baseURL }) => {
    await loginPage.goto('//evil.example');
    await loginPage.login(SEEDED_USER.email, SEEDED_USER.password);

    await expect(page).toHaveURL(`${baseURL}/`);
  });

  test('logging out ends the session @regression', async ({ page, freshUser, header }) => {
    await page.goto('/');
    await expect(header.userName).toHaveText(freshUser.name);

    await header.logoutButton.click();
    await expect(page).toHaveURL(/\/login/);

    // The old session must be dead, not just hidden
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
  });
});
