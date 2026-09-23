import { expect, test } from '@playwright/test';

test.describe('E2E Smoke', () => {
  test('loads kit page and verifies title', async ({ page }) => {
    await page.goto('/kit');
    await expect(page).toHaveTitle(/NAAD/);
  });
});
