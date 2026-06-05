import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 詳細画面の鳴き声再生ボタンを実ブラウザで検証する。
 *
 * 実際の .ogg 再生はブラウザ・CI 依存で確定しないため、ページ上で `window.Audio` を
 * 差し替えて生成された URL だけを記録する（再生自体は行わない）。これにより
 * 「クリック時に PokeAPI 由来の cry URL が参照される」ことをネットワーク非依存で検証できる。
 * 音源が無い（cryUrl: null）ミュウではボタンが無効化されることも確認する。
 */
test.describe('Pokemon detail cry playback', () => {
  /** `window.Audio` を記録専用スタブへ差し替え、`audio/ogg` を再生可能と申告させる。 */
  async function stubAudio(page: import('@playwright/test').Page): Promise<void> {
    await page.addInitScript(() => {
      const played: string[] = [];
      (window as unknown as { __playedCryUrls: string[] }).__playedCryUrls = played;
      class StubAudio {
        constructor(public readonly src?: string) {}
        canPlayType(type: string): string {
          return type === 'audio/ogg' ? 'probably' : '';
        }
        play(): Promise<void> {
          if (this.src) {
            played.push(this.src);
          }
          return Promise.resolve();
        }
      }
      (window as unknown as { Audio: unknown }).Audio = StubAudio;
    });
  }

  test('plays the cry source URL on click and follows a language toggle', async ({ page }) => {
    await stubAudio(page);
    await stubBff(page);
    await page.goto('/detail/6');

    const button = page.locator('.detail__cry');
    await expect(button).toBeEnabled();

    // ja: ラベルが日本語で出る。
    await expect(button).toContainText('なきごえ');

    await button.click();

    // クリックで PokeAPI 由来の cry URL が Audio に渡る。
    const played = await page.evaluate(
      () => (window as unknown as { __playedCryUrls: string[] }).__playedCryUrls,
    );
    expect(played).toEqual(['https://cries.test/latest/6.ogg']);

    // 言語切り替えでラベルが英語化される。
    await page.getByRole('button', { name: 'English' }).click();
    await expect(button).toContainText('Cry');
  });

  test('disables the button when the cry source is missing', async ({ page }) => {
    await stubAudio(page);
    await stubBff(page);
    await page.goto('/detail/151');

    await expect(page.locator('.detail__cry')).toBeDisabled();
  });
});
