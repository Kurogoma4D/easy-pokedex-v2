import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import { LocalizedName } from '../../i18n/localized-name';
import { Icon } from '../../shared/icon/icon';
import { MOCK_TYPES, TypeId } from '../mock/pokemon-mock-data';
import { TypeChip } from '../shared/type-chip';
import { typeChipStyle } from '../shared/type-style';
import { GENERATIONS, MAX_TYPE_SELECTION } from './pokemon-filters';

/** `{count}` プレースホルダを実数で置換する。 */
function withCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

/**
 * 検索／フィルタ UI（FR-2）。名前の部分一致・タイプの複数選択・世代を扱う。
 * 条件は `model` シグナルで親（一覧画面）と双方向に共有し、BFF 検索の実行は親が担う。
 *
 * タイプは BFF が最大 5 件までしか受け付けず超過時に 400 を返すため、選択を
 * `MAX_TYPE_SELECTION` 件に制限し、上限到達後は未選択トグルを無効化して不正リクエストを防ぐ。
 */
@Component({
  selector: 'app-pokemon-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypeChip, Icon],
  template: `
    <form class="search" (submit)="$event.preventDefault()">
      <div class="search__row">
        <label class="search__field">
          <span class="search__label">{{ messages()['search.nameLabel'] }}</span>
          <span class="search__input-wrap">
            <app-icon name="search" class="search__input-icon" />
            <input
              class="search__input search__input--name"
              type="search"
              [value]="name()"
              (input)="onNameInput($event)"
              [placeholder]="messages()['search.namePlaceholder']"
            />
          </span>
        </label>

        <label class="search__field">
          <span class="search__label">{{ messages()['search.generationLabel'] }}</span>
          <select
            class="search__input"
            [value]="generation()"
            (change)="onGenerationChange($event)"
          >
            <option value="">{{ messages()['search.generationAll'] }}</option>
            @for (gen of generations; track gen.id) {
              <option [value]="gen.id">{{ localize(gen.name) }}</option>
            }
          </select>
        </label>

        <button class="search__reset" type="button" (click)="reset()">
          <app-icon name="close" />
          {{ messages()['search.reset'] }}
        </button>
      </div>

      <fieldset class="search__types">
        <legend class="search__label search__label--icon">
          <app-icon name="filter" />
          {{ messages()['search.typeLabel'] }}
          @if (limitReached()) {
            <span class="search__badge">{{ typeLimitLabel() }}</span>
          }
        </legend>
        <div class="search__type-grid">
          @for (type of types; track type.id) {
            <button
              type="button"
              class="search__type"
              [class.is-selected]="isSelected(type.id)"
              [style]="chipStyle(type.id)"
              [attr.aria-pressed]="isSelected(type.id)"
              [disabled]="isDisabled(type.id)"
              (click)="toggleType(type.id)"
            >
              {{ localize(type.name) }}
            </button>
          }
        </div>
      </fieldset>

      @if (selectedTypes().length > 0) {
        <div class="search__active" aria-live="polite">
          @for (type of selectedTypes(); track type) {
            <app-type-chip [type]="type" />
          }
        </div>
      }
    </form>
  `,
  styles: `
    .search {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-3);
      background-color: var(--color-surface-raised);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-panel);
      box-shadow: var(--shadow-dot-sm);
    }
    .search__row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--space-3);
    }
    .search__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      flex: 1 1 12rem;
    }
    .search__label {
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      letter-spacing: var(--letter-spacing-display);
      color: var(--color-text);
    }
    .search__label--icon {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }
    /* Hint shown once the type-selection cap is reached. */
    .search__badge {
      margin-left: var(--space-1);
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
    }
    .search__input {
      font-family: var(--font-body);
      font-size: var(--font-size-body-sm);
      color: var(--color-text);
      background-color: var(--color-screen);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-chip);
      padding: var(--space-2);
      box-shadow: var(--shadow-screen-inset);
    }
    /* The name field reserves room on the left for the inline magnifier. */
    .search__input-wrap {
      position: relative;
      display: flex;
    }
    .search__input--name {
      flex: 1;
      padding-left: calc(var(--space-3) + var(--space-3));
    }
    .search__input-icon {
      position: absolute;
      left: var(--space-2);
      top: 50%;
      transform: translateY(-50%);
      font-size: var(--font-size-body-sm);
      color: var(--color-text-muted);
      pointer-events: none;
    }
    .search__reset {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }
    .search__types {
      margin: 0;
      padding: 0;
      border: none;
    }
    .search__type-grid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }
    /* Type toggles read as dimmed dot-matrix swatches until selected, when they
     * light up to the full type accent. */
    .search__type {
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
      color: var(--color-text);
      background-color: var(--color-screen);
      border: var(--border-width-chunky) solid var(--color-border-soft);
      border-radius: var(--radius-chip);
      padding: var(--space-1) var(--space-2);
      box-shadow: none;
      opacity: 0.72;
      transition:
        opacity var(--duration-fast) var(--easing-step),
        transform var(--duration-fast) var(--easing-step);
    }
    .search__type.is-selected {
      color: var(--chip-ink);
      background-color: var(--chip-fill);
      border-color: var(--color-border);
      box-shadow: var(--shadow-dot-sm);
      opacity: 1;
    }
    /* Unselected toggles dim out once the cap is reached so the BFF type limit
     * cannot be exceeded. */
    .search__type:disabled {
      cursor: not-allowed;
      opacity: 0.35;
    }
    .search__active {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
  `,
})
export class PokemonSearch {
  private readonly localeService = inject(LocaleService);

  protected readonly messages = this.localeService.messages;
  protected readonly types = MOCK_TYPES;
  protected readonly generations = GENERATIONS;

  /** 名前クエリ（部分一致）。 */
  readonly name = model('');
  /** 選択中のタイプ（AND 絞り込み、最大 `MAX_TYPE_SELECTION` 件）。 */
  readonly selectedTypes = model<readonly TypeId[]>([]);
  /** 選択中の世代識別子。空文字はすべて。 */
  readonly generation = model('');

  protected readonly limitReached = computed(
    () => this.selectedTypes().length >= MAX_TYPE_SELECTION,
  );
  protected readonly typeLimitLabel = computed(() =>
    withCount(this.messages()['search.typeLimit'], MAX_TYPE_SELECTION),
  );

  protected localize(name: LocalizedName): string {
    return this.localeService.localizeName(name);
  }

  protected chipStyle(type: TypeId): Record<string, string> {
    return typeChipStyle(type);
  }

  protected isSelected(type: TypeId): boolean {
    return this.selectedTypes().includes(type);
  }

  /** 上限到達後、まだ選んでいないタイプは選べないようにする。 */
  protected isDisabled(type: TypeId): boolean {
    return this.limitReached() && !this.isSelected(type);
  }

  protected toggleType(type: TypeId): void {
    this.selectedTypes.update((current) => {
      if (current.includes(type)) {
        return current.filter((t) => t !== type);
      }
      // 上限到達時の追加は無視する（テンプレートでも disabled だが念のため二重に防ぐ）。
      if (current.length >= MAX_TYPE_SELECTION) {
        return current;
      }
      return [...current, type];
    });
  }

  protected onNameInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected onGenerationChange(event: Event): void {
    this.generation.set((event.target as HTMLSelectElement).value);
  }

  protected reset(): void {
    this.name.set('');
    this.selectedTypes.set([]);
    this.generation.set('');
  }
}
