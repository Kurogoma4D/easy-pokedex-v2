import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 認証＋お気に入りの E2E。BFF をブラウザ層でスタブし、セッション・お気に入りをページ内状態として
 * 保持する。未ログインでの誘導、登録/ログイン、トグル、専用一覧の表示を実ブラウザで検証する。
 */
test.describe('Favorites and auth', () => {
  test.beforeEach(async ({ page }) => {
    await stubBff(page);
  });

  test('guest favorite action redirects to login', async ({ page }) => {
    await page.goto('/list');
    await expect(page.locator('.list__grid')).toBeVisible();

    // 一覧カードのお気に入りトグルを押すとログインへ誘導される（ゲスト保存はしない）。
    await page.locator('.card .fav').first().click();
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test('protected favorites page redirects guests to login', async ({ page }) => {
    await page.goto('/favorites');
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test('register, toggle a favorite and see it on the favorites page', async ({ page }) => {
    await page.goto('/register');

    await page.locator('input[name="email"]').fill('trainer@example.com');
    await page.locator('input[name="password"]').fill('password123');
    await page.getByRole('button', { name: 'とうろく' }).click();

    // 登録成功で一覧へ戻る。
    await expect(page).toHaveURL(/\/list$/);
    await expect(page.locator('.list__grid')).toBeVisible();

    // ログイン後はお気に入りリンクが現れる。
    await expect(page.getByRole('link', { name: 'おきにいり', exact: true })).toBeVisible();

    // 先頭カードをお気に入りに登録する。
    const firstToggle = page.locator('.card .fav').first();
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'false');
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'true');

    // お気に入り一覧ページに登録したポケモンが出る。
    await page.getByRole('link', { name: 'おきにいり', exact: true }).click();
    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.locator('.favorites__grid .card')).toHaveCount(1);
  });

  test('logout hides favorites and re-protects the page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('trainer@example.com');
    await page.locator('input[name="password"]').fill('password123');
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/\/list$/);

    await page.getByRole('button', { name: 'ログアウト' }).click();
    await expect(page.getByRole('link', { name: 'ログイン' })).toBeVisible();

    await page.goto('/favorites');
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });
});
