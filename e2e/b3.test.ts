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

  test('Album renders liner-notes header, track table and details', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop test');
    // Brahmastra album (a JioSaavn id, as served by naad)
    await page.goto('/album/38845390');

    // Header title and actions
    await expect(page.getByRole('heading', { name: 'Brahmastra' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Shuffle', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'Save', exact: true })).toBeVisible();

    // Track table with rows
    await expect(page.getByText('Kesariya').first()).toBeVisible();

    // Liner notes area. naad sends no ISRC, so every track says so instead of showing a code.
    await expect(page.getByText('Liner Notes & Catalog Record')).toBeVisible();
    await expect(page.getByText('NO ISRC').first()).toBeVisible();
  });
});
