import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 一覧／検索画面の名前検索を実ブラウザで検証する。BFF はスタブ済みで、入力に対して
 * マッチする結果が描画されることだけを見る（上流・BFF には依存しない）。
 */
test.describe('Pokemon name search', () => {
  test('typing a name query renders the matching result', async ({ page }) => {
    await stubBff(page);
    await page.goto('/list');

    // 初期のブラウズ一覧が出ている。
    const grid = page.locator('.list__grid');
    await expect(grid).toBeVisible();

    // 名前で検索する。
    await page.getByRole('searchbox').fill('リザードン');

    // マッチ結果のカードが描画される。
    const card = grid.locator('.card', { hasText: 'リザードン' });
    await expect(card).toBeVisible();
    await expect(card.locator('.card__dex')).toHaveText('#006');
  });
});
