import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 詳細画面のタイプ相性パネルを実ブラウザで検証する。BFF レスポンスはスタブ済みのため、
 * 描画結果（倍率ラベル・タイプチップのローカライズ）と言語切り替えへの追従だけを見る。
 */
test.describe('Pokemon detail type matchups', () => {
  test.beforeEach(async ({ page }) => {
    await stubBff(page);
    await page.goto('/detail/6');
  });

  test('renders the matchup panel with multiplier labels and localized chips (ja default)', async ({
    page,
  }) => {
    const matchups = page.locator('.matchups');
    await expect(matchups).toBeVisible();

    // セクション見出し（日本語）。
    await expect(matchups.getByRole('heading', { name: 'こうかばつぐん' })).toBeVisible();
    await expect(matchups.getByRole('heading', { name: 'いまひとつ' })).toBeVisible();
    await expect(matchups.getByRole('heading', { name: 'こうかなし' })).toBeVisible();

    // 倍率ラベル（×4 の弱点、×0.5 の耐性、×0 の無効）。
    await expect(matchups.locator('.matchups__multiplier', { hasText: '×4' })).toBeVisible();
    await expect(matchups.locator('.matchups__multiplier', { hasText: '×0.5' })).toBeVisible();
    await expect(
      matchups.locator('.matchups__multiplier').filter({ hasText: /^×0$/ }),
    ).toBeVisible();

    // ローカライズされたタイプチップ（×4 = いわ、×0 = じめん）。
    await expect(matchups.locator('.type-chip', { hasText: 'いわ' })).toBeVisible();
    await expect(matchups.locator('.type-chip', { hasText: 'じめん' })).toBeVisible();
  });

  test('updates section headings and chip labels when language toggles ja -> en', async ({
    page,
  }) => {
    const matchups = page.locator('.matchups');
    await expect(matchups.getByRole('heading', { name: 'こうかばつぐん' })).toBeVisible();
    await expect(matchups.locator('.type-chip', { hasText: 'いわ' })).toBeVisible();

    // 言語を English に切り替える。
    await page.getByRole('button', { name: 'English' }).click();

    // セクション見出しが英語化される。
    await expect(matchups.getByRole('heading', { name: 'Weak to' })).toBeVisible();
    await expect(matchups.getByRole('heading', { name: 'Resists' })).toBeVisible();
    await expect(matchups.getByRole('heading', { name: 'Immune to' })).toBeVisible();
    await expect(matchups.getByRole('heading', { name: 'こうかばつぐん' })).toHaveCount(0);

    // 相性のタイプチップ表記も英語化される。
    await expect(matchups.locator('.type-chip', { hasText: 'Rock' })).toBeVisible();
    await expect(matchups.locator('.type-chip', { hasText: 'Ground' })).toBeVisible();
    await expect(matchups.locator('.type-chip', { hasText: 'いわ' })).toHaveCount(0);
  });
});
