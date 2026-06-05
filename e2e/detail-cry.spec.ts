import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 詳細画面の鳴き声再生を実ブラウザで検証する。鳴き声 URL は PokeAPI 由来のものを
 * フロントが直接 Audio で参照する（BFF はプロキシしない）。音源・再生要求はスタブ済みのため、
 * ボタンの有効/無効・アクセシブルラベル・言語切替追従・実際の再生発火だけを見る。
 */
test.describe('Pokemon detail cry playback', () => {
  test('plays the cry and labels the button accessibly, following a language toggle', async ({
    page,
  }) => {
    await stubBff(page);
    await page.goto('/detail/6');

    const button = page.locator('.detail__cry');
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute('aria-label', 'なきごえを さいせい');

    // ラベルが言語切替に追従する（再生前に確認し、再生可否の影響を受けないようにする）。
    await page.getByRole('button', { name: 'English' }).click();
    await expect(button).toHaveAttribute('aria-label', 'Play cry');

    // 鳴き声 URL（PokeAPI 由来）への取得が直接走ること（= 実際に再生要求が出ること）を待つ。
    const cryRequest = page.waitForRequest('**/cries.test/**');
    await button.click();
    await cryRequest;
  });

  test('disables the play button when the Pokémon has no cry', async ({ page }) => {
    await stubBff(page);
    await page.goto('/detail/151');

    const button = page.locator('.detail__cry');
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-label', 'なきごえが ありません');

    // 言語切替で無効時ラベルも追従する。
    await page.getByRole('button', { name: 'English' }).click();
    await expect(button).toHaveAttribute('aria-label', 'No cry available');
  });
});
