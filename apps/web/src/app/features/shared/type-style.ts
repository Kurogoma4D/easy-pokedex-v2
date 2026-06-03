/**
 * タイプチップの配色を、`tokens.css` が公開する `--type-*` / `--type-*-ink` を参照する
 * インラインスタイルへ変換する。色そのものをコンポーネントに持たせず、デザイントークンの
 * 単一ソースから引くことでトークン更新が全画面へ波及するようにする。
 *
 * BFF が返すタイプ識別子は文字列のため引数も文字列で受ける。`tokens.css` は PokeAPI の
 * 全 18 タイプ（normal〜fairy）の `--type-*` / `--type-*-ink` を定義しており、想定外の識別子は
 * 来ない前提。万一未知の識別子が来た場合に備え、`var()` 第 2 引数で既定色へフォールバックする。
 */
export function typeChipStyle(type: string): Record<string, string> {
  return {
    '--chip-fill': `var(--type-${type}, var(--color-surface-raised))`,
    '--chip-ink': `var(--type-${type}-ink, var(--color-text))`,
  };
}
