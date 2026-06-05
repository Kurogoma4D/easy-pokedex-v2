import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 詳細画面の図鑑情報（説明文・分類・世代）と伝説/幻バッジを実ブラウザで検証する。
 * BFF レスポンスはスタブ済みのため、描画結果と言語切り替えへの追従だけを見る。
 */
test.describe('Pokemon detail dex info', () => {
  test('renders the dex entry, genus and generation, and follows a language toggle', async ({
    page,
  }) => {
    await stubBff(page);
    await page.goto('/detail/6');

    // ja: 説明文・分類・世代がすべて日本語で出る。
    await expect(page.getByRole('heading', { name: 'ずかんせつめい' })).toBeVisible();
    await expect(page.locator('.detail__flavor')).toContainText('きえん');
    await expect(page.locator('.detail__genus')).toContainText('かえんポケモン');
    await expect(page.locator('.detail__metrics')).toContainText('第1世代');

    // 言語を English に切り替える。
    await page.getByRole('button', { name: 'English' }).click();

    // 説明文・分類・世代・見出しが英語化される。
    await expect(page.getByRole('heading', { name: 'Dex entry' })).toBeVisible();
    await expect(page.locator('.detail__flavor')).toContainText('breathes fire');
    await expect(page.locator('.detail__genus')).toContainText('Flame Pokémon');
    await expect(page.locator('.detail__metrics')).toContainText('Generation I');
    await expect(page.locator('.detail__genus')).not.toContainText('かえんポケモン');
  });

  test('does not show legendary / mythical badges for an ordinary Pokémon', async ({ page }) => {
    await stubBff(page);
    await page.goto('/detail/6');

    await expect(page.locator('.detail__flavor')).toBeVisible();
    await expect(page.locator('.detail__badges')).toHaveCount(0);
  });

  test('shows both legendary and mythical badges for a legendary/mythical Pokémon', async ({
    page,
  }) => {
    await stubBff(page);
    await page.goto('/detail/151');

    const badges = page.locator('.detail__badges');
    await expect(badges).toBeVisible();
    await expect(page.locator('.detail__badge--legendary')).toContainText('でんせつ');
    await expect(page.locator('.detail__badge--mythical')).toContainText('まぼろし');

    // 言語切り替えでバッジ文言も追従する。
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('.detail__badge--legendary')).toContainText('Legendary');
    await expect(page.locator('.detail__badge--mythical')).toContainText('Mythical');
  });
});
