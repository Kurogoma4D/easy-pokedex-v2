import { hashPassword, verifyPassword } from './password.js';
import type { AuthRepository, SessionRecord, UserRecord } from './repository.js';
import { generateSessionId, sessionExpiry } from './session.js';

/**
 * ユーザー不在時にも bcrypt 比較を実行してレイテンシを揃えるためのダミーハッシュ。
 * これがないと存在しないメールだけ応答が速くなり、メール列挙を許してしまう。
 * 任意の文字列を SALT_ROUNDS=12 で bcrypt ハッシュした固定値。
 */
const DUMMY_HASH = '$2b$12$xh14yEXCgcafBuReGjD2UeMRBluSYRJXAPwmoFQV2mPGWYwAkyM4.';

/** 認証ユースケース。リポジトリ・パスワードハッシュ・セッション発行を束ね、ルート層から使う。 */
export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  /**
   * 新規ユーザーを作成する。メール重複時は null を返す（呼び出し側で 409）。
   * パスワードは保存前に必ずハッシュ化する。
   */
  async register(email: string, password: string): Promise<UserRecord | null> {
    const passwordHash = await hashPassword(password);
    return this.repo.createUser(email, passwordHash);
  }

  /** メール+パスワードを検証する。成功時のみユーザーを返す。 */
  async authenticate(email: string, password: string): Promise<UserRecord | null> {
    const user = await this.repo.findUserByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    return user !== null && valid ? user : null;
  }

  /** ユーザーに対し新しいセッションを発行し、その id を返す。 */
  async issueSession(userId: number): Promise<string> {
    const id = generateSessionId();
    await this.repo.createSession(id, userId, sessionExpiry());
    return id;
  }

  /** セッション id から有効なセッションを解決する。期限切れ・不存在は null。 */
  async resolveSession(id: string): Promise<SessionRecord | null> {
    return this.repo.findSession(id);
  }

  /** セッションを破棄する（ログアウト）。 */
  async revokeSession(id: string): Promise<void> {
    await this.repo.deleteSession(id);
  }

  /** id からユーザーを取得する。 */
  async findUser(id: number): Promise<UserRecord | null> {
    return this.repo.findUserById(id);
  }
}
