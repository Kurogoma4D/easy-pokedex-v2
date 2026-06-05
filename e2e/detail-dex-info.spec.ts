import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 詳細画面の図鑑情報（説明文・分類・世代・伝説/幻バッジ）を実ブラウザで検証する。
 * BFF レスポンスはスタブ済みのため、描画結果と言語切り替えへの追従だけを見る。
 */
test.describe('Pokemon detail dex info', () => {
  test('renders flavor text, genus and generation, and follows language toggle (ja -> en)', async ({
    page,
  }) => {
    await stubBff(page);
    await page.goto('/detail/6');

    // 図鑑説明文・分類・世代（日本語）。
    await expect(page.locator('.detail__flavor')).toContainText(
      'からだの ほのおは げんきの しょうこ。',
    );
    await expect(page.locator('.detail__genus')).toContainText('かえんポケモン');
    await expect(page.locator('.detail__metrics')).toContainText('第1世代');

    // 言語を English に切り替える。
    await page.getByRole('button', { name: 'English' }).click();

    // 説明文・分類・世代の表記が英語へ追従する。
    await expect(page.locator('.detail__flavor')).toContainText(
      'Its fiery breath is a sign of health.',
    );
    await expect(page.locator('.detail__genus')).toContainText('Flame Pokémon');
    await expect(page.locator('.detail__metrics')).toContainText('Generation I');
  });

  test('shows the legendary badge for a legendary species', async ({ page }) => {
    await stubBff(page);
    await page.goto('/detail/150');

    await expect(page.locator('.detail__badge--legendary')).toBeVisible();
    await expect(page.locator('.detail__badge--legendary')).toContainText('でんせつ');
  });

  test('does not show legendary/mythical badges for an ordinary species', async ({ page }) => {
    await stubBff(page);
    await page.goto('/detail/6');

    await expect(page.locator('.detail__flavor')).toBeVisible();
    await expect(page.locator('.detail__badges')).toHaveCount(0);
  });
});
