import { test, expect } from '@playwright/test';

test.describe('Weather Dashboard - Landing', () => {
  test('should load the landing page successfully', async ({ page }) => {
    await page.goto('/landing.html');
    
    // Verify the page title
    await expect(page).toHaveTitle(/Cosmic Weather Journal/);

    // Verify the hero text is visible
    await expect(page.locator('text=The Physics of the Atmosphere')).toBeVisible();

    // Verify login button is present
    await expect(page.locator('#nav-login-btn')).toBeVisible();
  });
});
