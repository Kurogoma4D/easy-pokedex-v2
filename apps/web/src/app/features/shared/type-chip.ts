import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import { LocalizedName } from '../../i18n/localized-name';
import { MOCK_TYPES } from '../mock/pokemon-mock-data';
import { typeChipStyle } from './type-style';

/** タイプ識別子（英語）から多言語表示名を引く固定辞書（18 種）。 */
const TYPE_NAME = new Map<string, LocalizedName>(MOCK_TYPES.map((t) => [t.id, t.name] as const));

/**
 * タイプチップ。`--type-*` 由来の配色で塗り、ロケールに応じた表示名を出す。
 * 一覧カード・検索フィルタ・詳細で共有する最小の表示単位。
 */
@Component({
  selector: 'app-type-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="type-chip" [style]="style()">{{ label() }}</span>`,
  styles: `
    .type-chip {
      display: inline-block;
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      letter-spacing: var(--letter-spacing-display);
      line-height: 1;
      color: var(--chip-ink);
      background-color: var(--chip-fill);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-chip);
      box-shadow: var(--shadow-dot-sm);
      white-space: nowrap;
    }
  `,
})
export class TypeChip {
  private readonly localeService = inject(LocaleService);

  readonly type = input.required<string>();
  /**
   * 表示名の多言語ソース。BFF が `LocalizedName` を返す呼び出し元はそれを渡す。
   * 未指定なら静的辞書（`TYPE_NAME`）で `type` から引き、辞書にも無ければ識別子をそのまま出す。
   */
  readonly name = input<LocalizedName | undefined>(undefined);

  protected readonly style = computed(() => typeChipStyle(this.type()));
  protected readonly label = computed(() => {
    const name = this.name() ?? TYPE_NAME.get(this.type());
    return name ? this.localeService.localizeName(name) : this.type();
  });
}
