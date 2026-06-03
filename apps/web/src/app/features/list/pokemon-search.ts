import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { LocaleService } from '../../i18n/locale.service';
import { LocalizedName } from '../../i18n/localized-name';
import { MOCK_GENERATIONS, MOCK_TYPES, TypeId } from '../mock/pokemon-mock-data';
import { TypeChip } from '../shared/type-chip';
import { typeChipStyle } from '../shared/type-style';

/**
 * 検索／フィルタ UI（FR-2）。名前の部分一致・タイプの複数選択・世代の単一選択を扱う。
 * 条件は `model` シグナルで親（一覧画面）と双方向に共有し、絞り込みの実行は親が担う。
 * ここではモックとして条件入力の見た目と操作感を確定させる。
 */
@Component({
  selector: 'app-pokemon-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypeChip],
  template: `
    <form class="search" (submit)="$event.preventDefault()">
      <div class="search__row">
        <label class="search__field">
          <span class="search__label">{{ messages()['search.nameLabel'] }}</span>
          <input
            class="search__input"
            type="search"
            [value]="name()"
            (input)="onNameInput($event)"
            [placeholder]="messages()['search.namePlaceholder']"
          />
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
          {{ messages()['search.reset'] }}
        </button>
      </div>

      <fieldset class="search__types">
        <legend class="search__label">{{ messages()['search.typeLabel'] }}</legend>
        <div class="search__type-grid">
          @for (type of types; track type.id) {
            <button
              type="button"
              class="search__type"
              [class.is-selected]="isSelected(type.id)"
              [style]="chipStyle(type.id)"
              [attr.aria-pressed]="isSelected(type.id)"
              (click)="toggleType(type.id)"
            >
              {{ localize(type.name) }}
            </button>
          }
        </div>
      </fieldset>

      @if (activeTypes().length > 0) {
        <div class="search__active" aria-live="polite">
          @for (type of activeTypes(); track type) {
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
    .search__reset {
      flex: 0 0 auto;
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
  protected readonly generations = MOCK_GENERATIONS;

  /** 名前クエリ（部分一致）。 */
  readonly name = model('');
  /** 選択中のタイプ（AND 絞り込み）。 */
  readonly selectedTypes = model<readonly TypeId[]>([]);
  /** 選択中の世代識別子。空文字はすべて。 */
  readonly generation = model('');

  protected readonly activeTypes = computed(() => this.selectedTypes());

  protected localize(name: LocalizedName): string {
    return this.localeService.localizeName(name);
  }

  protected chipStyle(type: TypeId): Record<string, string> {
    return typeChipStyle(type);
  }

  protected isSelected(type: TypeId): boolean {
    return this.selectedTypes().includes(type);
  }

  protected toggleType(type: TypeId): void {
    this.selectedTypes.update((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    );
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
