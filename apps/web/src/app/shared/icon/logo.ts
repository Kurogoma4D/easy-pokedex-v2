import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * アプリロゴ。ドット調の Poké Ball マークと、ピクセル表示フォントのワードマークを
 * 横並びにする。色はすべてデザイントークン（`--lcd-*` / `--led-power` ほか）を参照し、
 * フォントは `--font-display` を使うので、テーマ変更に追従する。
 *
 * `label` はワードマークの文言で、画面上に見えるテキストとして表示する。マーク SVG は
 * 装飾扱い（`aria-hidden`）にし、読み上げはワードマーク側に任せる。
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="logo">
      <svg
        class="logo__mark"
        viewBox="0 0 16 16"
        width="1em"
        height="1em"
        shape-rendering="crispEdges"
        focusable="false"
        aria-hidden="true"
      >
        <path
          class="logo__ink"
          d="M5 1h6v1H5zM3 2h2v1H3zM11 2h2v1h-2zM2 3h1v2H2zM13 3h1v2h-1zM1 5h1v6H1zM14 5h1v6h-1zM2 11h1v2H2zM13 11h1v2h-1zM3 13h2v1H3zM11 13h2v1h-2zM5 14h6v1H5z"
        />
        <path class="logo__lit" d="M5 2h6v1H5zM3 3h10v2H3zM2 5h12v2H2zM2 7h12v1H2z" />
        <path class="logo__ink" d="M1 8h13v1H1z" />
        <path
          class="logo__lit"
          d="M2 9h12v1H2zM2 10h12v1H2zM3 11h10v1H3zM5 12h6v2H5zM5 13h6v1H5z"
        />
        <path class="logo__ink" d="M6 6h4v1H6zM6 9h4v1H6zM6 7h1v2H6zM9 7h1v2H9z" />
        <path class="logo__led" d="M7 7h2v2H7z" />
      </svg>
      <span class="logo__word">{{ label() }}</span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    .logo__mark {
      display: block;
      /* Sized relative to the wordmark; a touch larger than the cap height. */
      font-size: 1.6em;
      image-rendering: pixelated;
      /* The dark ring sits on a thin lit halo so the mark reads on the bezel. */
      filter: drop-shadow(0 0 1px var(--lcd-0));
    }
    .logo__ink {
      fill: var(--lcd-3);
    }
    .logo__lit {
      fill: var(--lcd-0);
    }
    .logo__led {
      fill: var(--led-power);
    }
    .logo__word {
      font-family: var(--font-display);
      letter-spacing: var(--letter-spacing-display);
      line-height: 1;
    }
  `,
})
export class Logo {
  /** ワードマークとして表示し、読み上げ対象になる文言。 */
  readonly label = input.required<string>();
}
