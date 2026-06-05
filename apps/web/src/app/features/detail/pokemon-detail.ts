import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../i18n/locale.service';
import { LocalizedName } from '../../i18n/localized-name';
import { MessageKey } from '../../i18n/messages';
import { Icon } from '../../shared/icon/icon';
import { FavoriteButton } from '../favorites/favorite-button';
import { GENERATIONS } from '../list/pokemon-filters';
import { PokemonApiService } from '../list/pokemon-api.service';
import { TypeChip } from '../shared/type-chip';
import type { EvolutionNode, PokemonTypeMatchupGroup } from './pokemon-detail.model';

/** 種族値バーの上限。単一ステータスの取りうる上限に合わせて 0–100% を割り当てる。 */
const STAT_MAX = 255;

/** ステータス識別子から表示ラベルのメッセージキーを引く。上流が未知の id を返しても識別子を出せるよう Map で扱う。 */
const STAT_LABEL_KEYS = new Map<string, MessageKey>([
  ['hp', 'stat.hp'],
  ['attack', 'stat.attack'],
  ['defense', 'stat.defense'],
  ['special-attack', 'stat.special-attack'],
  ['special-defense', 'stat.special-defense'],
  ['speed', 'stat.speed'],
]);

/** 世代識別子から表示名を引く。検索フィルタと同じ静的一覧（`GENERATIONS`）を共有する。 */
const GENERATION_BY_ID = new Map(GENERATIONS.map((g) => [g.id, g.name]));

/** 進化チェーンのツリーを描画順の一次元配列へ平坦化する（分岐は深さ優先で直列化）。 */
function flattenChain(root: EvolutionNode): readonly EvolutionNode[] {
  const out: EvolutionNode[] = [];
  const walk = (node: EvolutionNode): void => {
    out.push(node);
    node.evolvesTo.forEach(walk);
  };
  walk(root);
  return out;
}

interface StatRow {
  readonly id: string;
  readonly label: string;
  readonly base: number;
  readonly percent: number;
}

/** タイプ相性の 1 セクション（弱点/耐性/無効）。見出しは選択ロケールの文言で解決済み。 */
interface MatchupSection {
  readonly id: 'weaknesses' | 'resistances' | 'immunities';
  readonly heading: string;
  readonly groups: readonly PokemonTypeMatchupGroup[];
}

/** 被ダメージ倍率を「×4」「×0.5」のような表示文字列に整える。小数は末尾ゼロを残さない。 */
function formatMultiplier(multiplier: number): string {
  return `×${Number(multiplier.toFixed(2))}`;
}

/**
 * 詳細画面（FR-3）。BFF の `/pokemon/:idOrName` を `httpResource` で取得して表示する。
 *
 * ルートの `:id`（`withComponentInputBinding` で束縛）をキーに取得し、id が変わると自動で再取得する。
 * 図鑑番号・名前・スプライト・タイプ・ステータス（バー）・特性・進化チェーン・図鑑情報・タイプ相性・
 * 鳴き声を 1 画面に集約する。固有名詞（名前・タイプ名・特性名）は BFF が返す `LocalizedName` を
 * `LocaleService` で選択ロケールへ解決するため、言語切り替えに追従する。
 *
 * 取得状況に応じて状態を出し分ける。読み込み中はローディング表示、上流 404 は「見つからない」表示、
 * その他の失敗（502 など）は汎用エラーと再試行ボタンを出す。
 */
@Component({
  selector: 'app-pokemon-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeChip, Icon, FavoriteButton],
  template: `
    <article class="detail">
      <a class="detail__back" routerLink="/list">
        <app-icon name="chevron-left" />
        {{ messages()['detail.back'] }}
      </a>

      @if (isLoading()) {
        <p class="detail__status detail__status--loading" role="status">
          {{ messages()['detail.loading'] }}
        </p>
      } @else if (isError()) {
        <p class="detail__status detail__status--error" role="alert">
          {{ notFound() ? messages()['detail.notFound'] : messages()['detail.error'] }}
          <button class="detail__retry" type="button" (click)="retry()">
            {{ messages()['detail.retry'] }}
          </button>
        </p>
      } @else if (data(); as detail) {
        <header class="detail__head">
          <span class="detail__dex">{{ dexNumber() }}</span>
          <div class="detail__art">
            @if (detail.imageUrl) {
              <img [src]="detail.imageUrl" [alt]="name()" decoding="async" />
            } @else {
              <span class="detail__art-fallback" aria-hidden="true">?</span>
            }
          </div>
          <div class="detail__title">
            <h1 class="detail__name">{{ name() }}</h1>
            <app-favorite-button [pokemonId]="detail.id" />
            <button
              class="detail__cry"
              type="button"
              [attr.aria-label]="cryLabel()"
              [title]="cryLabel()"
              [disabled]="!detail.cryUrl"
              (click)="playCry()"
            >
              <app-icon name="volume" />
            </button>
          </div>
          @if (genus()) {
            <p class="detail__genus">{{ genus() }}</p>
          }
          @if (detail.isLegendary || detail.isMythical) {
            <div class="detail__badges">
              @if (detail.isLegendary) {
                <span class="detail__badge detail__badge--legendary">{{
                  messages()['detail.legendary']
                }}</span>
              }
              @if (detail.isMythical) {
                <span class="detail__badge detail__badge--mythical">{{
                  messages()['detail.mythical']
                }}</span>
              }
            </div>
          }
          <div class="detail__types">
            @for (type of detail.types; track type.id) {
              <app-type-chip [type]="type.id" [name]="type.name" />
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
            <div>
              <dt>{{ messages()['detail.generation'] }}</dt>
              <dd>{{ generationName() }}</dd>
            </div>
          </dl>
        </header>

        @if (flavorText()) {
          <section class="detail__panel">
            <h2 class="detail__heading">{{ messages()['detail.dexEntry'] }}</h2>
            <p class="detail__flavor">{{ flavorText() }}</p>
          </section>
        }

        <section class="detail__panel">
          <h2 class="detail__heading">{{ messages()['detail.stats'] }}</h2>
          <ul class="stats" role="list">
            @for (stat of stats(); track stat.id) {
              <li class="stats__row">
                <span class="stats__label">{{ stat.label }}</span>
                <span class="stats__value">{{ stat.base }}</span>
                <span
                  class="stats__bar"
                  role="meter"
                  [attr.aria-label]="stat.label"
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
            @for (ability of detail.abilities; track ability.id) {
              <li class="abilities__item">
                <span>{{ localize(ability.name) }}</span>
                @if (ability.isHidden) {
                  <span class="abilities__hidden">{{ messages()['detail.abilityHidden'] }}</span>
                }
              </li>
            }
          </ul>
        </section>

        <section class="detail__panel matchups">
          <h2 class="detail__heading">{{ messages()['detail.matchups'] }}</h2>
          @for (section of matchupSections(); track section.id) {
            <div class="matchups__section">
              <h3 class="matchups__heading">{{ section.heading }}</h3>
              <ul class="matchups__groups" role="list">
                @for (group of section.groups; track group.multiplier) {
                  <li class="matchups__group">
                    <span class="matchups__multiplier">{{
                      formatMultiplier(group.multiplier)
                    }}</span>
                    <span class="matchups__chips">
                      @for (type of group.types; track type.id) {
                        <app-type-chip [type]="type.id" [name]="type.name" />
                      }
                    </span>
                  </li>
                } @empty {
                  <li class="matchups__empty">{{ messages()['detail.matchups.empty'] }}</li>
                }
              </ul>
            </div>
          }
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
      }
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
    .detail__status,
    .detail__retry,
    .detail__genus,
    .detail__badge,
    .detail__flavor,
    .stats__label,
    .stats__value,
    .stats__total,
    .abilities__hidden,
    .matchups__heading,
    .matchups__multiplier,
    .matchups__empty,
    .evo__name {
      font-family: var(--font-display);
      font-size: var(--font-size-display-sm);
    }
    .detail__back {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-text);
      text-decoration: none;
    }
    .detail__status {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-4);
      text-align: center;
      color: var(--color-text);
    }
    .detail__status--loading {
      color: var(--color-text-muted);
      animation: detail-blink 800ms steps(2, end) infinite;
    }
    @keyframes detail-blink {
      50% {
        opacity: 0.25;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .detail__status--loading {
        animation: none;
      }
    }
    .detail__head,
    .detail__panel {
      background-color: var(--color-surface-raised);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-panel);
      box-shadow: var(--shadow-dot-sm);
    }
    .detail__head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-4);
    }
    .detail__dex {
      align-self: flex-start;
      font-size: var(--font-size-display-md);
      color: var(--color-text-muted);
    }
    .detail__art,
    .evo__art {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--color-screen);
      border: var(--border-width-chunky) solid var(--color-border);
      box-shadow: var(--shadow-screen-inset);
    }
    .detail__art {
      width: 12rem;
      max-width: 60vw;
      aspect-ratio: 1 / 1;
      border-radius: var(--radius-screen);
    }
    .detail__art img,
    .evo__art img {
      object-fit: contain;
      image-rendering: pixelated;
    }
    .detail__art img {
      width: 84%;
      height: 84%;
    }
    .detail__art-fallback {
      font-family: var(--font-display);
      font-size: var(--font-size-display-xl);
      color: var(--color-text-muted);
    }
    .detail__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .detail__name {
      margin: 0;
      font-size: var(--font-size-display-lg);
    }
    /* Cry trigger styled as a chunky dot-matrix button; disabled state is dimmed. */
    .detail__cry {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1);
      color: var(--color-text);
      background-color: var(--color-screen);
      border: var(--border-width-chunky) solid var(--color-border);
      border-radius: var(--radius-pixel);
      box-shadow: var(--shadow-dot-sm);
      cursor: pointer;
    }
    .detail__cry:disabled {
      color: var(--color-text-muted);
      opacity: 0.5;
      cursor: not-allowed;
    }
    .detail__genus,
    .detail__flavor {
      margin: 0;
    }
    .detail__genus {
      color: var(--color-text-muted);
    }
    .detail__flavor {
      line-height: 1.6;
      white-space: pre-line;
    }
    .detail__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .detail__badge {
      padding: 0 var(--space-2);
      color: var(--color-text-inverse);
      background-color: var(--color-text);
      border-radius: var(--radius-pixel);
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
    }
    .detail__heading {
      margin: 0 0 var(--space-3);
      font-size: var(--font-size-display-md);
    }

    .stats,
    .abilities,
    .evo {
      display: flex;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .stats {
      flex-direction: column;
      gap: var(--space-2);
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
      flex-wrap: wrap;
      gap: var(--space-2);
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

    .matchups,
    .matchups__section,
    .matchups__groups {
      display: flex;
      flex-direction: column;
    }
    .matchups {
      gap: var(--space-3);
    }
    .matchups__section,
    .matchups__groups {
      gap: var(--space-2);
    }
    .matchups__groups {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .matchups__heading,
    .matchups__empty {
      margin: 0;
      color: var(--color-text-muted);
    }
    .matchups__group,
    .matchups__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .matchups__group {
      align-items: center;
    }
    .matchups__multiplier {
      flex: none;
      min-width: 3rem;
    }

    .evo {
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
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
      width: 5rem;
      height: 5rem;
      border-color: var(--color-border-soft);
      border-radius: var(--radius-chip);
    }
    .evo__art img {
      width: 80%;
      height: 80%;
    }
    .evo__arrow {
      color: var(--color-text-muted);
    }
  `,
})
export class PokemonDetail {
  private readonly localeService = inject(LocaleService);
  private readonly api = inject(PokemonApiService);

  protected readonly messages = this.localeService.messages;
  protected readonly statMax = STAT_MAX;

  /** ルートパラメータ `:id`。withComponentInputBinding で束縛される。 */
  readonly id = input<string>('');

  private readonly resource = this.api.detailResource(this.id);

  /**
   * 鳴き声再生用の Audio。PokeAPI 由来の URL を直接参照する（BFF はプロキシしない、issue #61）。
   * cryUrl の変化に追従して差し替え、コンポーネント破棄時に停止する。
   */
  private audio: HTMLAudioElement | null = null;

  protected readonly isLoading = this.resource.isLoading;
  protected readonly isError = computed(() => this.resource.error() !== undefined);

  /** 上流 404（未知の id/name）。それ以外の失敗（502 など）と区別してメッセージを出し分ける。 */
  protected readonly notFound = computed(() => {
    const error = this.resource.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });

  protected readonly data = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );

  protected readonly name = computed(() => {
    const detail = this.data();
    return detail ? this.localeService.localizeName(detail.name) : '';
  });
  protected readonly dexNumber = computed(() => {
    const detail = this.data();
    return detail ? `#${detail.id.toString().padStart(3, '0')}` : '';
  });
  protected readonly heightMeters = computed(() => {
    const detail = this.data();
    return detail ? (detail.height / 10).toFixed(1) : '';
  });
  protected readonly weightKg = computed(() => {
    const detail = this.data();
    return detail ? (detail.weight / 10).toFixed(1) : '';
  });
  protected readonly flavorText = computed(() => {
    const detail = this.data();
    return detail ? this.localeService.localizeName(detail.flavorText) : '';
  });
  protected readonly genus = computed(() => {
    const detail = this.data();
    return detail ? this.localeService.localizeName(detail.genus) : '';
  });

  /** 鳴き声の URL。音源が無い場合は null（ボタンを無効化する）。 */
  protected readonly cryUrl = computed(() => this.data()?.cryUrl ?? null);

  /** 鳴き声ボタンのアクセシブルなラベル。音源の有無で文言を出し分け、言語切り替えに追従する。 */
  protected readonly cryLabel = computed(() => {
    const messages = this.messages();
    return this.cryUrl() ? messages['detail.cryPlay'] : messages['detail.cryUnavailable'];
  });

  /**
   * 世代の表示名。検索フィルタと同じ `GENERATIONS` から選択ロケールで解決する。
   * 未知の世代識別子（一覧に無い id）の場合は識別子そのものをフォールバックとして出す。
   */
  protected readonly generationName = computed(() => {
    const detail = this.data();
    if (!detail) {
      return '';
    }
    const name = GENERATION_BY_ID.get(detail.generation);
    return name ? this.localeService.localizeName(name) : detail.generation;
  });
  protected readonly statTotal = computed(() => {
    const detail = this.data();
    return detail ? detail.stats.reduce((sum, stat) => sum + stat.base, 0) : 0;
  });
  protected readonly evolution = computed<readonly EvolutionNode[]>(() => {
    const detail = this.data();
    return detail ? flattenChain(detail.evolutionChain) : [];
  });

  protected readonly stats = computed<readonly StatRow[]>(() => {
    const detail = this.data();
    if (!detail) {
      return [];
    }
    const messages = this.messages();
    return detail.stats.map((stat) => {
      const labelKey = STAT_LABEL_KEYS.get(stat.id);
      return {
        id: stat.id,
        label: labelKey ? messages[labelKey] : stat.id,
        base: stat.base,
        percent: Math.min(100, (stat.base / STAT_MAX) * 100),
      };
    });
  });

  /**
   * タイプ相性のセクション表示用ビューモデル。見出し文言を選択ロケールで解決するため、
   * `messages` signal を読む computed にして言語切り替えに追従させる。
   */
  protected readonly matchupSections = computed<readonly MatchupSection[]>(() => {
    const detail = this.data();
    if (!detail) {
      return [];
    }
    const messages = this.messages();
    const matchups = detail.typeMatchups;
    return [
      {
        id: 'weaknesses',
        heading: messages['detail.matchups.weaknesses'],
        groups: matchups.weaknesses,
      },
      {
        id: 'resistances',
        heading: messages['detail.matchups.resistances'],
        groups: matchups.resistances,
      },
      {
        id: 'immunities',
        heading: messages['detail.matchups.immunities'],
        groups: matchups.immunities,
      },
    ];
  });

  constructor() {
    // cryUrl の変化に合わせて Audio を作り直す。再生中の音源が次のポケモンに引き継がれないよう、
    // 既存があれば停止してから差し替える。SSR 等で Audio が無い環境では生成しない。
    effect(() => {
      const url = this.cryUrl();
      this.stopAudio();
      this.audio = url !== null && typeof Audio !== 'undefined' ? new Audio(url) : null;
    });
    inject(DestroyRef).onDestroy(() => this.stopAudio());
  }

  protected formatMultiplier(multiplier: number): string {
    return formatMultiplier(multiplier);
  }

  protected localize(name: LocalizedName): string {
    return this.localeService.localizeName(name);
  }

  /**
   * 鳴き声を再生する。音源が無ければ何もしない。再生は冒頭へ巻き戻してから開始し、
   * 連打や端末側の再生不可（`play()` の reject）でも例外を投げず穏当に無視する。
   */
  protected playCry(): void {
    const audio = this.audio;
    if (audio === null) {
      return;
    }
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }

  private stopAudio(): void {
    if (this.audio !== null) {
      this.audio.pause();
      this.audio = null;
    }
  }

  /** エラー後に同じ id を取得し直す。 */
  protected retry(): void {
    this.resource.reload();
  }
}
