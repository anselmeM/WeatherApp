import { test, expect } from '@playwright/test';

test.describe('Weather Dashboard - Landing Page UI Widget', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console logs and page errors
    page.on('console', msg => console.log(`BROWSER CONSOLE: [${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

    // Open the landing page
    await page.goto('/landing.html');
  });

  test('should load landing page with default weather widget values', async ({ page }) => {
    // Verify default active state (clear theme)
    await expect(page.locator('#pill-clear')).toHaveClass(/active/);
    await expect(page.locator('#preview-city')).toHaveText('Miami');
    await expect(page.locator('#preview-temp')).toHaveText('82°F');
    await expect(page.locator('#preview-desc')).toHaveText('Solaris / Clear & Unobstructed');
    
    // Verify default background theme class on body
    await expect(page.locator('body')).toHaveClass(/theme-clear/);
  });

  test('should update widget when clicking different weather state pills', async ({ page }) => {
    // Click on the Rain state pill
    await page.locator('#pill-rain').click();
    
    // Verify the widget updates to Seattle data
    await expect(page.locator('#pill-rain')).toHaveClass(/active/);
    await expect(page.locator('#pill-clear')).not.toHaveClass(/active/);
    await expect(page.locator('#preview-city')).toHaveText('Seattle');
    await expect(page.locator('#preview-temp')).toHaveText('58°F');
    await expect(page.locator('#preview-desc')).toHaveText('Imber / Moderate Precipitation');
    await expect(page.locator('#preview-humidity')).toHaveText('88%');
    await expect(page.locator('#preview-wind')).toHaveText(/14 mph/);
    await expect(page.locator('#preview-alert')).toHaveText('Steady precipitation active. High humidity saturating topsoils.');
    await expect(page.locator('body')).toHaveClass(/theme-rain/);

    // Click on the Storm state pill
    await page.locator('#pill-storm').click();
    
    // Verify the widget updates to Houston data
    await expect(page.locator('#pill-storm')).toHaveClass(/active/);
    await expect(page.locator('#pill-rain')).not.toHaveClass(/active/);
    await expect(page.locator('#preview-city')).toHaveText('Houston');
    await expect(page.locator('#preview-temp')).toHaveText('76°F');
    await expect(page.locator('#preview-desc')).toHaveText('Procella / Severe Cyclonic Disturbances');
    await expect(page.locator('#preview-alert')).toHaveText('Severe cyclonic warning. Rapidly falling pressure. Shelter indoors.');
    await expect(page.locator('body')).toHaveClass(/theme-storm/);
  });
});
