import { test, expect } from '@playwright/test';
import { _before, _beforeEach, _afterEach } from './fixtures.js';

test.describe('game UI', async () => {
  test.beforeAll(_before);
  test.beforeEach(_beforeEach);
  test.afterEach(_afterEach);

  test('should ask for starting player in 1-Player mode', async ({ page }) => {
    await page.getByRole('button', { name: '1 Player' }).click();
    const buttons = page.locator('#game-dashboard button');
    await expect(buttons.nth(0)).toHaveText('Human');
    await expect(buttons.nth(1)).toHaveText('Mr. A.I.');
  });

  test('should ask for a player name in different-device 2-Player mode', async ({ page }) => {
    await page.getByRole('button', { name: '2 Players' }).click();
    await page.getByRole('button', { name: 'Different device' }).click();
    await expect(page.locator('#game-message')).toHaveText('Enter your player name:');
    await expect(page.locator('#new-player-name')).toBeVisible();
  });

  test('should show room code entry from device choice screen', async ({ page }) => {
    await page.getByRole('button', { name: '2 Players' }).click();
    await page.getByRole('button', { name: 'Join with code' }).click();
    await expect(page.locator('#game-message label')).toHaveText('Enter the 4-letter room code:');
    await expect(page.locator('#room-code')).toBeVisible();
  });

  test('should show validation error for invalid room code', async ({ page }) => {
    await page.getByRole('button', { name: 'Join with code' }).click();
    await page.locator('#room-code').fill('AB');
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page.locator('#room-code-error')).toHaveText('Enter a 4-letter room code.');
  });

  test('should navigate to room URL and prompt for player name after joining with code', async ({
    browser
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto('./');
    await hostPage.getByRole('button', { name: '2 Players' }).click();
    await hostPage.getByRole('button', { name: 'Different device' }).click();
    await hostPage.locator('#new-player-name').fill('Host');
    await hostPage.getByRole('button', { name: 'Start Game' }).click();
    await expect(hostPage).toHaveURL(/\/room\/[A-Z]{4}$/);

    const roomCode = hostPage.url().match(/\/room\/([A-Z]{4})$/)[1];

    await guestPage.goto('./');
    await guestPage.getByRole('button', { name: 'Join with code' }).click();
    await guestPage.locator('#room-code').fill(roomCode);
    await guestPage.getByRole('button', { name: 'Join' }).click();
    await expect(guestPage).toHaveURL(new RegExp(`/room/${roomCode}$`));
    await expect(guestPage.locator('#game-message label')).toHaveText('Enter your player name:');
    await expect(guestPage.locator('#new-player-name')).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });

  test('should start with Human when chosen in 1-Player mode', async ({ page }) => {
    await page.getByRole('button', { name: '1 Player' }).click();
    await page.getByRole('button', { name: 'Human' }).click();
    const pendingChip = page.locator('.chip.pending');
    await expect(pendingChip).toHaveClass(/red/);
  });

  test('should start with AI when chosen in 1-Player mode', async ({ page }) => {
    await page.getByRole('button', { name: '1 Player' }).click();
    await page.getByRole('button', { name: 'Mr. A.I.' }).click();
    const pendingChip = page.locator('.chip.pending');
    await expect(pendingChip).toHaveClass(/black/);
  });

  test('should start same-device 2-Player mode with Human 2', async ({ page }) => {
    await page.getByRole('button', { name: '2 Players' }).click();
    await page.getByRole('button', { name: 'Same device' }).click();
    const pendingChip = page.locator('.chip.pending');
    await expect(pendingChip).toHaveClass(/blue/);
  });

  test('should alternate same-device 2-Player starting players', async ({ page }) => {
    await page.getByRole('button', { name: '2 Players' }).click();
    await page.getByRole('button', { name: 'Same device' }).click();
    await page.getByRole('button', { name: 'End Game' }).click();
    await page.getByRole('button', { name: '2 Players' }).click();
    await page.getByRole('button', { name: 'Same device' }).click();
    const pendingChip = page.locator('.chip.pending');
    await expect(pendingChip).toHaveClass(/red/);
  });
});
