import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICON_PATHS, IconName } from './icon-defs';

/**
 * ピクセル調 UI アイコンをインライン SVG として描画する。
 *
 * 塗りは `currentColor` のため、配置先のフォント色トークンがそのまま反映される。
 * 既定では装飾扱い（`aria-hidden="true"`）で、`label` を渡したときだけ
 * `role="img"` + `aria-label` を付けて読み上げ対象にする。
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="icon"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="currentColor"
      shape-rendering="crispEdges"
      focusable="false"
      [attr.aria-hidden]="decorative() ? 'true' : null"
      [attr.role]="decorative() ? null : 'img'"
      [attr.aria-label]="decorative() ? null : label()"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .icon {
      display: block;
      /* Pixel art must scale by whole steps to stay crisp. */
      image-rendering: pixelated;
    }
  `,
})
export class Icon {
  /** 描画するアイコン名。 */
  readonly name = input.required<IconName>();
  /** スクリーンリーダー向けラベル。未指定なら装飾アイコンとして扱う。 */
  readonly label = input<string>();

  protected readonly path = computed(() => ICON_PATHS[this.name()]);
  protected readonly decorative = computed(() => !this.label());
}
