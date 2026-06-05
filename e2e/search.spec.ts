import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 一覧／検索画面の名前検索を実ブラウザで検証する。BFF スタブは `name` パラメータを本物の BFF と
 * 同じ正規化（NFKC + ひらがな→カタカナ, trim/lowercase）に通して候補名へ部分一致判定するため、
 * かな正規化の経路を E2E が実際に通る（固定値を返すだけにならない）。
 */
test.describe('Pokemon name search', () => {
  test('typing a katakana name query renders the matching result', async ({ page }) => {
    await stubBff(page);
    await page.goto('/list');

    // 初期のブラウズ一覧が出ている。
    const grid = page.locator('.list__grid');
    await expect(grid).toBeVisible();

    // カタカナで検索する。
    await page.getByRole('searchbox').fill('リザードン');

    // マッチ結果のカードが描画される。
    const card = grid.locator('.card', { hasText: 'リザードン' });
    await expect(card).toBeVisible();
    await expect(card.locator('.card__dex')).toHaveText('#006');
  });

  test('typing a hiragana query hits the katakana-named result', async ({ page }) => {
    await stubBff(page);
    await page.goto('/list');

    const grid = page.locator('.list__grid');
    await expect(grid).toBeVisible();

    // ひらがな「りざ」はカタカナ名「リザードン」にヒットする（かな正規化）。
    await page.getByRole('searchbox').fill('りざ');

    const card = grid.locator('.card', { hasText: 'リザードン' });
    await expect(card).toBeVisible();
    await expect(card.locator('.card__dex')).toHaveText('#006');
  });

  test('a non-matching query renders the empty state', async ({ page }) => {
    await stubBff(page);
    await page.goto('/list');

    await expect(page.locator('.list__grid')).toBeVisible();

    // 候補名のどの正規化形にも含まれないクエリは空結果になる。
    await page.getByRole('searchbox').fill('ぴかちゅう');

    await expect(page.locator('.list__empty')).toBeVisible();
    await expect(page.locator('.list__grid')).toHaveCount(0);
  });
});
