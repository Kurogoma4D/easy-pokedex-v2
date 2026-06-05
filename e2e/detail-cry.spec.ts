import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 詳細画面の鳴き声(cry)再生ボタンを実ブラウザで検証する。BFF レスポンスはスタブ済みのため、
 * ボタンの有効/無効・アクセシブルラベル・言語切り替えへの追従と、再生時に PokeAPI 由来 URL を
 * 直接 Audio で参照すること（BFF をプロキシしないこと）を見る。
 */
test.describe('Pokemon detail cry playback', () => {
  test('enables the cry button, labels it accessibly and follows a language toggle', async ({
    page,
  }) => {
    await stubBff(page);
    await page.goto('/detail/6');

    const button = page.locator('.detail__cry');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    // ja: 再生ラベル。
    await expect(button).toHaveAttribute('aria-label', /さいせい/);

    await page.getByRole('button', { name: 'English' }).click();
    await expect(button).toHaveAttribute('aria-label', 'Play cry');
  });

  test('plays the PokeAPI cry url directly via Audio (BFF is not proxied) when clicked', async ({
    page,
  }) => {
    // Audio.play() を傍受して再生対象の src を記録する。実音源の再生はヘッドレスで不安定なため、
    // 「どの URL を直接 Audio で再生しようとしたか」を確定的に検証する（BFF 経由でないことを含む）。
    await page.addInitScript(() => {
      const w = window as unknown as { __playedSrc?: string };
      const original = window.HTMLMediaElement.prototype.play;
      window.HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
        w.__playedSrc = this.currentSrc || this.src;
        return Promise.resolve();
      } as typeof original;
    });

    await stubBff(page);
    await page.goto('/detail/6');

    const button = page.locator('.detail__cry');
    await expect(button).toBeEnabled();
    await button.click();

    const playedSrc = await page.evaluate(
      () => (window as unknown as { __playedSrc?: string }).__playedSrc,
    );
    expect(playedSrc).toContain('raw.githubusercontent.com');
    expect(playedSrc).toContain('/6.ogg');
    expect(playedSrc).not.toContain('/api/');
  });

  test('disables the cry button and labels it unavailable when there is no cry url', async ({
    page,
  }) => {
    await stubBff(page);
    await page.goto('/detail/7');

    const button = page.locator('.detail__cry');
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-label', /ありません/);

    await page.getByRole('button', { name: 'English' }).click();
    await expect(button).toHaveAttribute('aria-label', 'No cry available');
  });
});
