/**
 * タイプチップの配色を、`tokens.css` が公開する `--type-*` / `--type-*-ink` を参照する
 * インラインスタイルへ変換する。色そのものをコンポーネントに持たせず、デザイントークンの
 * 単一ソースから引くことでトークン更新が全画面へ波及するようにする。
 *
 * BFF が返すタイプ識別子は文字列のため引数も文字列で受ける。トークンに無い識別子の場合は
 * 未定義の CSS 変数を参照することになるが、`tokens.css` 側でフォールバック色を持たせる前提。
 */
export function typeChipStyle(type: string): Record<string, string> {
  return {
    '--chip-fill': `var(--type-${type})`,
    '--chip-ink': `var(--type-${type}-ink)`,
  };
}
