import { expect, test } from '@playwright/test';
import { stubBff } from './fixtures';

/**
 * 詳細画面の鳴き声再生ボタンを実ブラウザで検証する。
 *
 * 実音源の再生可否はブラウザ依存のため、ここでは「ボタンが表示・活性化され、クリックで
 * 正しい音源 URL が Audio で参照されること」と「音源欠落時にボタンが無効化されること」を見る。
 * `Audio` をページ初期化時に差し替え、構築 URL と `play()` 呼び出しを記録して観測する。
 */
test.describe('Pokemon detail cry', () => {
  test('plays the cry by referencing the source url on click', async ({ page }) => {
    await stubBff(page);
    // Audio の構築 URL と play() 呼び出しを記録する。実音源の再生に依存しないため決定的に検証できる。
    await page.addInitScript(() => {
      const calls: { url: string; played: boolean }[] = [];
      (window as unknown as { __cryCalls: typeof calls }).__cryCalls = calls;
      const NativeAudio = window.Audio;
      class TrackingAudio extends NativeAudio {
        constructor(src?: string) {
          super(src);
          const record = { url: src ?? '', played: false };
          calls.push(record);
          const originalPlay = this.play.bind(this);
          this.play = (): Promise<void> => {
            record.played = true;
            return originalPlay().catch(() => undefined);
          };
        }
        // ブラウザの ogg サポートに依存せず、再生ボタンが活性化されることを保証する。
        canPlayType(): CanPlayTypeResult {
          return 'maybe';
        }
      }
      window.Audio = TrackingAudio as unknown as typeof window.Audio;
    });

    await page.goto('/detail/6');

    const button = page.getByRole('button', { name: 'リザードンの なきごえを さいせいする' });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();

    await button.click();

    const calls = await page.evaluate(
      () => (window as unknown as { __cryCalls: { url: string; played: boolean }[] }).__cryCalls,
    );
    // canPlayType 判定用に空 URL の Audio も構築されるため、実際に play() された音源だけを見る。
    const played = calls.filter((call) => call.played);
    expect(played).toHaveLength(1);
    expect(played[0]!.url).toContain('/cries/pokemon/latest/6.ogg');
  });

  test('exposes an accessible label that follows the language toggle', async ({ page }) => {
    await stubBff(page);
    await page.goto('/detail/6');

    await expect(
      page.getByRole('button', { name: 'リザードンの なきごえを さいせいする' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('button', { name: "Play Charizard's cry" })).toBeVisible();
  });

  test('disables the play button when the cry source is missing', async ({ page }) => {
    await stubBff(page);
    await page.goto('/detail/151');

    const button = page.getByRole('button', { name: 'ミュウの なきごえを さいせいする' });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
  });
});
