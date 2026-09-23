import { expect, test } from '@playwright/test';

test.describe('Home and Album Routes', () => {
  test('Home renders real sections from engine', async ({ page }) => {
    await page.goto('/');

    // Check title and discovery heading
    await expect(page).toHaveTitle(/NAAD/);
    await expect(page.getByRole('heading', { level: 1, name: 'Jump back in' })).toBeVisible();

    // Check that at least one discovery shelf renders
    const shelf = page.locator('section').first();
    await expect(shelf).toBeVisible();
  });

  test('Album renders liner-notes header, track table with quality badges, and details', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop test');
    // Brahmastra album
    await page.goto('/album/alb_01m34h87p5bh35km3rvpvt7r7y');

    // Header title and actions
    await expect(page.getByRole('heading', { name: 'Brahmastra' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Shuffle', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Save', exact: true })).toBeVisible();

    // Track table with rows
    await expect(page.getByText('Kesariya').first()).toBeVisible();

    // Check for quality badge on Kesariya
    const badge = page.getByText(/HI-RES/).first();
    await expect(badge).toBeVisible();

    // Check for liner notes details area with ISRC
    await expect(page.getByText('Liner Notes & Catalog Record')).toBeVisible();
    await expect(page.getByText('INS172203702').first()).toBeVisible();
  });
});
