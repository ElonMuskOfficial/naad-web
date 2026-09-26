import { expect, test } from '@playwright/test';

test.describe('App Shell', () => {
  test('renders shell correctly for desktop viewport', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop test');
    await page.goto('/');

    // Check document title
    await expect(page).toHaveTitle(/NAAD/);

    // Sidebar navigation visible
    const sidebar = page.locator('aside[aria-label="Main Navigation"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Home')).toBeVisible();
    await expect(sidebar.getByText('Search')).toBeVisible();
    await expect(sidebar.getByText('Library')).toBeVisible();
    await expect(sidebar.getByText('Playlists', { exact: true })).toBeVisible();

    // Desktop player bar visible (72px)
    const playerBar = page.locator('footer[aria-label="Audio Player"]');
    await expect(playerBar).toBeVisible();
    await expect(playerBar.locator('button[aria-label="Play"], button[aria-label="Pause"]')).toBeVisible();
    await expect(playerBar.locator('input[aria-label="Seek"]')).toBeVisible();
    await expect(playerBar.locator('input[aria-label="Volume"]')).toBeVisible();

    // Desktop right panel visible
    const rightPanel = page.locator('aside[aria-label="Secondary Panel"]');
    await expect(rightPanel).toBeVisible();
    await expect(rightPanel.getByText('Up next')).toBeVisible();
    await expect(rightPanel.getByText('Lyrics')).toBeVisible();
  });

  test('renders shell correctly for mobile viewport', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 640, 'Mobile test');
    await page.goto('/');

    // Desktop sidebar and right panel must be hidden
    await expect(page.locator('aside[aria-label="Main Navigation"]')).toBeHidden();
    await expect(page.locator('aside[aria-label="Secondary Panel"]')).toBeHidden();
    await expect(page.locator('footer[aria-label="Audio Player"]')).toBeHidden();

    // Mobile navigation bar visible
    const mobileNav = page.locator('nav[aria-label="Mobile Navigation"]');
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByText('Home')).toBeVisible();
    await expect(mobileNav.getByText('Search')).toBeVisible();

    // Mobile mini-player is hidden when no track is loaded
    const miniPlayer = page.locator('div[aria-label="Mini Player"]');
    await expect(miniPlayer).toBeHidden();
  });
});
