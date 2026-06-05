/**
 * ピクセル調 UI アイコンのパス定義。
 *
 * すべて 16x16 のドットグリッド上で `<path>` の矩形塗りとして描く（`shape-rendering`
 * は `crispEdges`）。塗りは `currentColor` を使うため、フォント色トークンを当てれば
 * そのままアイコン色になる。新しいアイコンを足すときはこの辞書にキーとパスを追加する。
 */
export const ICON_PATHS = {
  /** 言語切替（地球儀）。外周の円と、緯線・経線をドットで表す。 */
  globe:
    'M6 1h4v1H6zM4 2h2v1H4zM10 2h2v1h-2zM3 3h1v1H3zM12 3h1v1h-1zM2 4h1v2H2zM13 4h1v2h-1z' +
    'M2 10h1v2H2zM13 10h1v2h-1zM3 12h1v1H3zM12 12h1v1h-1zM4 13h2v1H4zM10 13h2v1h-2zM6 14h4v1H6z' +
    'M7 2h2v12H7zM2 7h12v2H2z' +
    'M4 3h1v1H4zM11 3h1v1h-1zM3 5h1v1H3zM12 5h1v1h-1zM3 10h1v1H3zM12 10h1v1h-1zM4 12h1v1H4zM11 12h1v1h-1z',
  /** 検索（虫眼鏡）。 */
  search:
    'M5 1h5v1H5zM3 2h2v1H3zM10 2h2v1h-2zM2 3h1v6H2zM12 3h1v6h-1zM3 9h2v1H3zM10 9h2v1h-2zM5 10h5v1H5z' +
    'M10 10h2v1h-2zM11 11h2v1h-2zM12 12h2v1h-2zM13 13h2v2h-2z',
  /** タイプ／絞り込み（スライダー）。3 本のトラックにつまみを 1 つずつ載せる。 */
  filter: 'M2 3h12v1H2zM2 8h12v1H2zM2 13h12v1H2z' + 'M4 2h2v3H4zM9 7h2v3H9zM6 12h2v3H6z',
  /** ナビゲーション：右シェブロン。 */
  'chevron-right': 'M5 2h2v2H5zM7 4h2v2H7zM9 6h2v2H9zM9 8h2v2H9zM7 10h2v2H7zM5 12h2v2H5z',
  /** ナビゲーション：左シェブロン（戻る）。 */
  'chevron-left': 'M9 2h2v2H9zM7 4h2v2H7zM5 6h2v2H5zM5 8h2v2H5zM7 10h2v2H7zM9 12h2v2H9z',
  /** リセット／クリア（×）。 */
  close:
    'M2 2h2v2H2zM4 4h2v2H4zM6 6h2v2H6zM8 6h2v2H8zM10 4h2v2h-2zM12 2h2v2h-2z' +
    'M6 8h2v2H6zM8 8h2v2H8zM4 10h2v2H4zM10 10h2v2h-2zM2 12h2v2H2zM12 12h2v2h-2z',
  /** 音量／鳴き声（スピーカーと音波）。左側のコーンと右側の 2 本の音波で表す。 */
  volume:
    'M5 6h2v4H5zM3 6h2v4H3zM7 4h2v8H7zM9 3h1v10H9z' +
    'M11 5h1v1h-1zM12 6h1v4h-1zM11 10h1v1h-1zM13 3h1v1h-1zM14 4h1v8h-1zM13 12h1v1h-1z',
} as const;

export type IconName = keyof typeof ICON_PATHS;
