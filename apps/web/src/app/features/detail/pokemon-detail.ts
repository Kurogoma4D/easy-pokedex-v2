import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../i18n/locale.service';
import { MessageKey } from '../../i18n/messages';
import { LocalizedName } from '../../i18n/localized-name';
import { MOCK_DETAIL, MockEvolutionNode, MockStat } from '../mock/pokemon-mock-data';
import { TypeChip } from '../shared/type-chip';

/** 種族値バーの上限。単一ステータスの取りうる上限に合わせて 0–100% を割り当てる。 */
const STAT_MAX = 255;

/** 進化チェーンのツリーを描画順の一次元配列へ平坦化する（分岐なしモック向けの直列化）。 */
function flattenChain(root: MockEvolutionNode): readonly MockEvolutionNode[] {
  const out: MockEvolutionNode[] = [];
  const walk = (node: MockEvolutionNode): void => {
    out.push(node);
    node.evolvesTo.forEach(walk);
  };
  walk(root);
  return out;
}

interface StatRow {
  readonly id: MockStat['id'];
  readonly labelKey: MessageKey;
  readonly base: number;
  readonly percent: number;
}

/**
 * 詳細画面のモックアップ（FR-3）。
 *
 * 図鑑番号・名前・スプライト・タイプ・ステータス（バー）・特性・進化チェーン・ずかん説明を
 * 1 画面に集約して表示する。データは静的モック（`MOCK_DETAIL`）で、BFF 集約レスポンスへの
 * 差し替えは機能 Issue（#13）が担う。
 */
@Component({
  selector: 'app-pokemon-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeChip],
  template: `
    <article class="detail">
      <a class="detail__back" routerLink="/list">‹ {{ messages()['detail.back'] }}</a>

      <header class="detail__head">
        <span class="detail__dex">{{ dexNumber() }}</span>
        <div class="detail__art">
          @if (data.imageUrl) {
            <img [src]="data.imageUrl" [alt]="name()" decoding="async" />
          } @else {
            <span class="detail__art-fallback" aria-hidden="true">?</span>
          }
        </div>
        <h1 class="detail__name">{{ name() }}</h1>
        <div class="detail__types">
          @for (type of data.types; track type) {
            <app-type-chip [type]="type" />
          }
        </div>
        <dl class="detail__metrics">
          <div>
            <dt>{{ messages()['detail.height'] }}</dt>
            <dd>{{ heightMeters() }} m</dd>
          </div>
          <div>
            <dt>{{ messages()['detail.weight'] }}</dt>
            <dd>{{ weightKg() }} kg</dd>
          </div>
        </dl>
      </header>

      <section class="detail__panel">
        <h2 class="detail__heading">{{ messages()['detail.flavor'] }}</h2>
        <p class="detail__flavor">{{ flavor() }}</p>
      </section>

      <section class="detail__panel">
        <h2 class="detail__heading">{{ messages()['detail.stats'] }}</h2>
        <ul class="stats" role="list">
          @for (stat of stats(); track stat.id) {
            <li class="stats__row">
              <span class="stats__label">{{ messages()[stat.labelKey] }}</span>
              <span class="stats__value">{{ stat.base }}</span>
              <span
                class="stats__bar"
                role="meter"
                [attr.aria-valuenow]="stat.base"
                aria-valuemin="0"
                [attr.aria-valuemax]="statMax"
              >
                <span class="stats__fill" [style.width.%]="stat.percent"></span>
              </span>
            </li>
          }
        </ul>
        <p class="stats__total">{{ messages()['detail.statTotal'] }}: {{ statTotal() }}</p>
      </section>

      <section class="detail__panel">
        <h2 class="detail__heading">{{ messages()['detail.abilities'] }}</h2>
        <ul class="abilities" role="list">
          @for (ability of data.abilities; track ability.id) {
            <li class="abilities__item">
              <span>{{ localize(ability.name) }}</span>
              @if (ability.isHidden) {
                <span class="abilities__hidden">{{ messages()['detail.abilityHidden'] }}</span>
              }
            </li>
          }
        </ul>
      </section>

      <section class="detail__panel">
        <h2 class="detail__heading">{{ messages()['detail.evolution'] }}</h2>
        <ol class="evo" role="list">
          @for (node of evolution(); track node.id; let last = $last) {
            <li class="evo__node">
              <a class="evo__link" [routerLink]="['/detail', node.id]">
                <span class="evo__art">
                  @if (node.imageUrl) {
                    <img [src]="node.imageUrl" [alt]="localize(node.name)" decoding="async" />
                  }
                </span>
                <span class="evo__name">{{ localize(node.name) }}</span>
              </a>
              @if (!last) {
                <span class="evo__arrow" aria-hidden="true">▸</span>
              }
            </li>
          }
        </ol>
      </section>
    </article>
  `,
  styles: `
    .detail {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    /* Shared dot-matrix label face for the dex chrome. */
    .detail__back,
    .detail__dex,
    .detail__metrics dt,
    .detail__metrics dd,
    .stats__label,
    .stats__value,
    .stats__total,
    .abilities__hidden,
    .evo__name {
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
    }
    .detail__back {
      align-self: flex-start;
      color: var(--color-text);
      text-decoration: none;
    }
    .detail__head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-4);
      background-color: var(--color-surface-raised);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-panel);
      box-shadow: var(--shadow-dot-sm);
    }
    .detail__dex {
      align-self: flex-start;
      font-size: var(--font-size-display-md);
      color: var(--color-text-muted);
    }
    .detail__art {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 12rem;
      max-width: 60vw;
      aspect-ratio: 1 / 1;
      background-color: var(--color-screen);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-screen);
      box-shadow: var(--shadow-screen-inset);
    }
    .detail__art img {
      width: 84%;
      height: 84%;
      object-fit: contain;
      image-rendering: pixelated;
    }
    .detail__art-fallback {
      font-family: var(--font-display);
      font-size: var(--font-size-display-xl);
      color: var(--color-text-muted);
    }
    .detail__name {
      margin: 0;
      font-size: var(--font-size-display-lg);
    }
    .detail__types {
      display: flex;
      gap: var(--space-2);
    }
    .detail__metrics {
      display: flex;
      gap: var(--space-5);
      margin: var(--space-2) 0 0;
    }
    .detail__metrics div {
      text-align: center;
    }
    .detail__metrics dt {
      color: var(--color-text-muted);
    }
    .detail__metrics dd {
      margin: var(--space-1) 0 0;
      font-size: var(--font-size-display-md);
    }
    .detail__panel {
      padding: var(--space-3);
      background-color: var(--color-surface-raised);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-panel);
      box-shadow: var(--shadow-dot-sm);
    }
    .detail__heading {
      margin: 0 0 var(--space-3);
      font-size: var(--font-size-display-md);
    }
    .detail__flavor {
      margin: 0;
      font-size: var(--font-size-body-sm);
    }

    .stats {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .stats__row {
      display: grid;
      grid-template-columns: 5rem 2.5rem 1fr;
      align-items: center;
      gap: var(--space-2);
    }
    .stats__label {
      color: var(--color-text-muted);
    }
    .stats__value {
      text-align: right;
    }
    /* Stat meter rendered as a recessed dot-matrix track with a lit fill. */
    .stats__bar {
      display: block;
      height: var(--space-3);
      background-color: var(--color-screen);
      border: var(--border-width-hairline) solid var(--color-border-soft);
      border-radius: var(--radius-pixel);
      box-shadow: var(--shadow-screen-inset);
      overflow: hidden;
    }
    .stats__fill {
      display: block;
      height: 100%;
      background-color: var(--lcd-2);
      transition: width var(--duration-base) var(--easing-step);
    }
    .stats__total {
      margin: var(--space-3) 0 0;
      text-align: right;
    }

    .abilities {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .abilities__item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background-color: var(--color-screen);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-chip);
    }
    .abilities__hidden {
      color: var(--color-text-inverse);
      background-color: var(--color-text-muted);
      padding: 0 var(--space-1);
      border-radius: var(--radius-pixel);
    }

    .evo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .evo__node {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .evo__link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      text-decoration: none;
      color: var(--color-text);
    }
    .evo__art {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 5rem;
      height: 5rem;
      background-color: var(--color-screen);
      border: var(--border-width-chunky) solid var(--color-border-soft);
      border-radius: var(--radius-chip);
      box-shadow: var(--shadow-screen-inset);
    }
    .evo__art img {
      width: 80%;
      height: 80%;
      object-fit: contain;
      image-rendering: pixelated;
    }
    .evo__arrow {
      color: var(--color-text-muted);
    }
  `,
})
export class PokemonDetail {
  private readonly localeService = inject(LocaleService);

  protected readonly messages = this.localeService.messages;
  protected readonly statMax = STAT_MAX;

  /** ルートパラメータ `:id`。withComponentInputBinding で束縛される。 */
  readonly id = input<string>('');

  // モックは単一のポケモン（フシギダネ）を表示する。id 連動の取得は機能 Issue が担う。
  protected readonly data = MOCK_DETAIL;

  protected readonly name = computed(() => this.localeService.localizeName(this.data.name));
  protected readonly flavor = computed(() => this.localeService.localizeName(this.data.flavorText));
  protected readonly dexNumber = computed(() => `#${this.data.id.toString().padStart(3, '0')}`);
  protected readonly heightMeters = computed(() => (this.data.height / 10).toFixed(1));
  protected readonly weightKg = computed(() => (this.data.weight / 10).toFixed(1));
  protected readonly statTotal = computed(() =>
    this.data.stats.reduce((sum, stat) => sum + stat.base, 0),
  );
  protected readonly evolution = computed(() => flattenChain(this.data.evolutionChain));

  private readonly statLabelKeys: Readonly<Record<MockStat['id'], MessageKey>> = {
    hp: 'stat.hp',
    attack: 'stat.attack',
    defense: 'stat.defense',
    'special-attack': 'stat.special-attack',
    'special-defense': 'stat.special-defense',
    speed: 'stat.speed',
  };

  protected readonly stats = computed<readonly StatRow[]>(() =>
    this.data.stats.map((stat) => ({
      id: stat.id,
      labelKey: this.statLabelKeys[stat.id],
      base: stat.base,
      percent: Math.min(100, (stat.base / STAT_MAX) * 100),
    })),
  );

  protected localize(name: LocalizedName): string {
    return this.localeService.localizeName(name);
  }
}
