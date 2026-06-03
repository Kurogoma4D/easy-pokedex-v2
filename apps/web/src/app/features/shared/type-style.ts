import { TypeId } from '../mock/pokemon-mock-data';

/**
 * タイプチップの配色を、`tokens.css` が公開する `--type-*` / `--type-*-ink` を参照する
 * インラインスタイルへ変換する。色そのものをコンポーネントに持たせず、デザイントークンの
 * 単一ソースから引くことでトークン更新が全画面へ波及するようにする。
 */
export function typeChipStyle(type: TypeId): Record<string, string> {
  return {
    '--chip-fill': `var(--type-${type})`,
    '--chip-ink': `var(--type-${type}-ink)`,
  };
}
