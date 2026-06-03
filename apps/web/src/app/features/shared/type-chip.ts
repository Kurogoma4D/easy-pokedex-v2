import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import { MOCK_TYPES, TypeId } from '../mock/pokemon-mock-data';
import { typeChipStyle } from './type-style';

/** タイプ表示名を識別子から引く（モック用の固定辞書）。 */
const TYPE_NAME = new Map(MOCK_TYPES.map((t) => [t.id, t.name] as const));

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

  readonly type = input.required<TypeId>();

  protected readonly style = computed(() => typeChipStyle(this.type()));
  protected readonly label = computed(() => {
    const name = TYPE_NAME.get(this.type());
    return name ? this.localeService.localizeName(name) : this.type();
  });
}
