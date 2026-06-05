import { Locale } from './locale';

/**
 * UI 文言の辞書。全ロケールが同一のキー集合を持つことを型で強制する。
 * ja を基準にキーを定義し、他ロケールは `Record<MessageKey, string>` で同じキーを要求する。
 */
const ja = {
  'app.title': 'イージーポケモン図鑑',
  'nav.list': '一覧',
  'nav.detail': '詳細',
  'nav.favorites': 'おきにいり',
  'nav.login': 'ログイン',
  'nav.register': 'とうろく',
  'nav.logout': 'ログアウト',
  'locale.label': '言語',
  'locale.ja': '日本語',
  'locale.en': 'English',
  'a11y.localeSwitch': '言語の切り替え',

  // 一覧画面（モックアップ）
  'list.title': 'ずかん',
  'list.count': '{count}ひき とうろくずみ',
  'list.empty': 'じょうけんに あう ポケモンが いません。',
  'list.loadingMore': 'よみこみちゅう…',
  'list.endOfList': 'ここまで',
  'list.error': 'ポケモンの よみこみに しっぱいしました。',
  'list.retry': 'もういちど',

  // 検索／フィルタ
  'search.title': 'けんさく',
  'search.nameLabel': 'なまえ',
  'search.namePlaceholder': 'なまえで さがす',
  'search.typeLabel': 'タイプ',
  'search.typeLimit': 'タイプは{count}つまで',
  'search.generationLabel': 'せだい',
  'search.generationAll': 'すべて',
  'search.reset': 'リセット',
  'search.resultSummary': '{count}けん ヒット',
  'search.searching': 'けんさくちゅう…',
  'search.error': 'けんさくに しっぱいしました。',

  // 詳細画面（モックアップ）
  'detail.height': 'たかさ',
  'detail.weight': 'おもさ',
  'detail.types': 'タイプ',
  'detail.stats': 'ステータス',
  'detail.statTotal': 'ごうけい',
  'detail.abilities': 'とくせい',
  'detail.abilityHidden': 'かくれとくせい',
  'detail.dexEntry': 'ずかんせつめい',
  'detail.generation': 'せだい',
  'detail.legendary': 'でんせつ',
  'detail.mythical': 'まぼろし',
  'detail.matchups': 'タイプ相性',
  'detail.matchups.weaknesses': 'こうかばつぐん',
  'detail.matchups.resistances': 'いまひとつ',
  'detail.matchups.immunities': 'こうかなし',
  'detail.matchups.empty': 'なし',
  'detail.cry': 'なきごえ',
  'detail.cryPlay': 'なきごえを さいせい',
  'detail.cryUnavailable': 'なきごえは ありません',
  'detail.evolution': 'しんか',
  'detail.back': 'いちらんへ',
  'detail.loading': 'よみこみちゅう…',
  'detail.error': 'ポケモンの よみこみに しっぱいしました。',
  'detail.notFound': 'その ポケモンは みつかりませんでした。',
  'detail.retry': 'もういちど',

  // ステータス名
  'stat.hp': 'HP',
  'stat.attack': 'こうげき',
  'stat.defense': 'ぼうぎょ',
  'stat.special-attack': 'とくこう',
  'stat.special-defense': 'とくぼう',
  'stat.speed': 'すばやさ',

  // 認証（ログイン・登録）
  'auth.login.title': 'ログイン',
  'auth.login.submit': 'ログイン',
  'auth.login.toRegister': 'アカウントを つくる',
  'auth.register.title': 'アカウント とうろく',
  'auth.register.submit': 'とうろく',
  'auth.register.toLogin': 'ログインへ',
  'auth.email.label': 'メールアドレス',
  'auth.email.placeholder': 'you@example.com',
  'auth.password.label': 'パスワード',
  'auth.password.placeholder': '8もじ いじょう',
  'auth.password.hint': 'パスワードは 8もじ いじょう',
  'auth.error.required': 'メールアドレスと パスワードを にゅうりょくして ください。',
  'auth.error.emailInvalid': 'メールアドレスの けいしきが ただしく ありません。',
  'auth.error.passwordTooShort': 'パスワードは 8もじ いじょうで にゅうりょくして ください。',
  'auth.error.invalidCredentials': 'メールアドレスか パスワードが ちがいます。',
  'auth.error.duplicateEmail': 'その メールアドレスは すでに とうろくずみです。',
  'auth.error.unknown': 'しっぱいしました。もういちど おためし ください。',
  'auth.submitting': 'そうしんちゅう…',
  'auth.greeting': '{email} で ログインちゅう',

  // お気に入り
  'favorites.title': 'おきにいり',
  'favorites.add': 'おきにいりに ついか',
  'favorites.remove': 'おきにいりを かいじょ',
  'favorites.empty': 'おきにいりの ポケモンは まだ いません。',
  'favorites.loading': 'よみこみちゅう…',
  'favorites.error': 'おきにいりの よみこみに しっぱいしました。',
  'favorites.loginRequired': 'おきにいりを みるには ログインして ください。',
  'favorites.toggleError':
    'おきにいりの こうしんに しっぱいしました。もう いちど おためしください。',
} as const;

export type MessageKey = keyof typeof ja;

export type MessageDictionary = Record<MessageKey, string>;

const en: MessageDictionary = {
  'app.title': 'Easy Pokédex',
  'nav.list': 'List',
  'nav.detail': 'Detail',
  'nav.favorites': 'Favorites',
  'nav.login': 'Log in',
  'nav.register': 'Sign up',
  'nav.logout': 'Log out',
  'locale.label': 'Language',
  'locale.ja': '日本語',
  'locale.en': 'English',
  'a11y.localeSwitch': 'Switch language',

  // List screen (mockup)
  'list.title': 'POKÉDEX',
  'list.count': '{count} registered',
  'list.empty': 'No Pokémon match these filters.',
  'list.loadingMore': 'Loading more…',
  'list.endOfList': 'End of list',
  'list.error': 'Failed to load Pokémon.',
  'list.retry': 'Retry',

  // Search / filter
  'search.title': 'SEARCH',
  'search.nameLabel': 'Name',
  'search.namePlaceholder': 'Search by name',
  'search.typeLabel': 'Type',
  'search.typeLimit': 'Up to {count} types',
  'search.generationLabel': 'Generation',
  'search.generationAll': 'All',
  'search.reset': 'Reset',
  'search.resultSummary': '{count} results',
  'search.searching': 'Searching…',
  'search.error': 'Search failed.',

  // Detail screen (mockup)
  'detail.height': 'Height',
  'detail.weight': 'Weight',
  'detail.types': 'Type',
  'detail.stats': 'Stats',
  'detail.statTotal': 'Total',
  'detail.abilities': 'Abilities',
  'detail.abilityHidden': 'Hidden',
  'detail.dexEntry': 'Dex entry',
  'detail.generation': 'Generation',
  'detail.legendary': 'Legendary',
  'detail.mythical': 'Mythical',
  'detail.matchups': 'Type matchups',
  'detail.matchups.weaknesses': 'Weak to',
  'detail.matchups.resistances': 'Resists',
  'detail.matchups.immunities': 'Immune to',
  'detail.matchups.empty': 'None',
  'detail.cry': 'Cry',
  'detail.cryPlay': 'Play cry',
  'detail.cryUnavailable': 'No cry available',
  'detail.evolution': 'Evolution',
  'detail.back': 'Back to list',
  'detail.loading': 'Loading…',
  'detail.error': 'Failed to load this Pokémon.',
  'detail.notFound': 'That Pokémon could not be found.',
  'detail.retry': 'Retry',

  // Stat names
  'stat.hp': 'HP',
  'stat.attack': 'Attack',
  'stat.defense': 'Defense',
  'stat.special-attack': 'Sp. Atk',
  'stat.special-defense': 'Sp. Def',
  'stat.speed': 'Speed',

  // Authentication (login / register)
  'auth.login.title': 'Log in',
  'auth.login.submit': 'Log in',
  'auth.login.toRegister': 'Create an account',
  'auth.register.title': 'Create account',
  'auth.register.submit': 'Sign up',
  'auth.register.toLogin': 'Back to log in',
  'auth.email.label': 'Email',
  'auth.email.placeholder': 'you@example.com',
  'auth.password.label': 'Password',
  'auth.password.placeholder': 'At least 8 characters',
  'auth.password.hint': 'Password must be at least 8 characters',
  'auth.error.required': 'Enter your email and password.',
  'auth.error.emailInvalid': 'Email format is invalid.',
  'auth.error.passwordTooShort': 'Password must be at least 8 characters.',
  'auth.error.invalidCredentials': 'Incorrect email or password.',
  'auth.error.duplicateEmail': 'That email is already registered.',
  'auth.error.unknown': 'Something went wrong. Please try again.',
  'auth.submitting': 'Submitting…',
  'auth.greeting': 'Signed in as {email}',

  // Favorites
  'favorites.title': 'Favorites',
  'favorites.add': 'Add to favorites',
  'favorites.remove': 'Remove from favorites',
  'favorites.empty': "You haven't added any favorites yet.",
  'favorites.loading': 'Loading…',
  'favorites.error': 'Failed to load favorites.',
  'favorites.loginRequired': 'Log in to see your favorites.',
  'favorites.toggleError': 'Failed to update favorites. Please try again.',
};

export const MESSAGES: Record<Locale, MessageDictionary> = {
  ja,
  en,
};
