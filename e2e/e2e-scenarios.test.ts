import { expect, test } from '@playwright/test';

test.describe('Phase D: End-to-End Scenarios', () => {
  test('1. Home loads cleanly with real discovery sections', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/NAAD/);
    await expect(page.getByRole('heading', { level: 1, name: 'Jump back in' })).toBeVisible();

    // Verify sections rendered
    const sections = page.locator('section');
    await expect(sections.first()).toBeVisible();
  });

  test('2. Search as-you-type and typed tabs', async ({ page }) => {
    await page.goto('/search');
    const searchInput = page.getByPlaceholder(/Search songs/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('kesariya');
    // Debounce wait
    await page.waitForTimeout(500);

    // Results container should render tracks and top result
    await expect(page.getByText(/Kesariya/i).first()).toBeVisible();

    // Test typed tabs
    const tracksTab = page.getByRole('tab', { name: /Tracks/i });
    if (await tracksTab.isVisible()) {
      await tracksTab.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/Kesariya/i).first()).toBeVisible();
    }
  });

  test('3. Command Palette opening, filtering and closing', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop test');
    await page.goto('/');
    await page.locator('body').click();

    // Press Control+k
    await page.keyboard.press('Control+k');
    const paletteInput = page.getByPlaceholder(/Type a command/i);
    await expect(paletteInput).toBeVisible();

    // Filter commands
    await paletteInput.fill('theme');
    await expect(page.getByText(/Switch to Light Theme/i)).toBeVisible();
    await expect(page.getByText(/Switch to Dark Theme/i)).toBeVisible();

    // Close on Escape
    await page.keyboard.press('Escape');
    await expect(paletteInput).not.toBeVisible();
  });

  test('4. Global keyboard shortcuts for playback', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop test');
    await page.goto('/');
    await page.locator('body').click();

    // Space toggles playback
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Arrow keys for seek
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
  });

  test('5. Track Context Menu on track row', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop test');
    await page.goto('/artist/art_01m34h87jnjf8n105kms455jnb');

    // Wait for track rows to render
    const row = page.locator('[role="row"]').first();
    await expect(row).toBeVisible();

    // Open context menu via more button
    const moreBtn = row.locator('button[aria-label^="More options"]');
    await moreBtn.click();

    // Verify context menu options
    await expect(page.getByRole('menuitem', { name: /Play next/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Add to queue/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Start radio/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Save to Liked Songs/i })).toBeVisible();
  });

  test('6. Import page validation and elements', async ({ page }) => {
    await page.goto('/import');
    await expect(page.getByRole('heading', { name: 'Import Playlist' })).toBeVisible();

    const urlInput = page.getByPlaceholder(/open\.spotify\.com/i);
    await expect(urlInput).toBeVisible();
    const submitBtn = page.getByRole('button', { name: /Start Import/i });
    await expect(submitBtn).toBeVisible();
  });

  test('7. Settings page and preferences', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Verify API key and quality tiers
    await expect(page.locator('#api-key')).toBeVisible();
    await expect(page.getByText('Wi-Fi & Ethernet Network')).toBeVisible();
    await expect(page.getByText('Cellular / Metered Network')).toBeVisible();
    await expect(page.getByText('EBU R128 Loudness Normalization')).toBeVisible();
    await expect(page.getByText('Crossfade Duration')).toBeVisible();
  });

  test('8. Mobile navigation and mini-player', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) > 640, 'Mobile test');
    await page.goto('/');

    // Bottom navigation bar
    const nav = page.locator('nav[aria-label="Mobile Navigation"]');
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Home')).toBeVisible();
    await expect(nav.getByText('Search')).toBeVisible();
    await expect(nav.getByText('Library')).toBeVisible();
    await expect(nav.getByText('Settings')).toBeVisible();

    // Navigate to Search via bottom nav
    await nav.getByText('Search').click();
    await expect(page).toHaveURL(/\/search/);
  });
});
