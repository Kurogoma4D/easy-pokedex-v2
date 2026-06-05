/**
 * 認証のユースケース（登録・ログイン・ログアウト・セッション解決）。
 *
 * バリデーション・ハッシュ化・永続化を束ね、ルート層へは結果型を返す。
 * ルート層はこの結果を HTTP（ステータス・Cookie）へ写像するだけにする。
 */

import { hashPassword, verifyPassword } from './password.js';
import { type AuthRepository, DuplicateEmailError, type UserRecord } from './repository.js';
import { generateSessionId, sessionExpiry } from './session.js';
import { type CredentialsInput, type FieldError, validateCredentials } from './validation.js';

export interface AuthenticatedUser {
  readonly id: number;
  readonly email: string;
}

export interface SessionIssue {
  readonly sessionId: string;
  readonly expiresAt: Date;
}

export type RegisterResult =
  | { readonly ok: true; readonly user: AuthenticatedUser; readonly session: SessionIssue }
  | { readonly ok: false; readonly kind: 'validation'; readonly errors: FieldError[] }
  | { readonly ok: false; readonly kind: 'duplicate' };

export type LoginResult =
  | { readonly ok: true; readonly user: AuthenticatedUser; readonly session: SessionIssue }
  | { readonly ok: false; readonly kind: 'validation'; readonly errors: FieldError[] }
  | { readonly ok: false; readonly kind: 'invalid_credentials' };

function toAuthenticatedUser(user: UserRecord): AuthenticatedUser {
  return { id: user.id, email: user.email };
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  /** セッションを発行して DB に保存し、発行情報を返す。 */
  private async issueSession(userId: number): Promise<SessionIssue> {
    const sessionId = generateSessionId();
    const expiresAt = sessionExpiry();
    await this.repo.createSession(sessionId, userId, expiresAt);
    return { sessionId, expiresAt };
  }

  async register(input: CredentialsInput): Promise<RegisterResult> {
    const validation = validateCredentials(input);
    if (!validation.ok) {
      return { ok: false, kind: 'validation', errors: validation.errors };
    }

    const passwordHash = await hashPassword(validation.value.password);
    let user: UserRecord;
    try {
      user = await this.repo.createUser(validation.value.email, passwordHash);
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        return { ok: false, kind: 'duplicate' };
      }
      throw error;
    }

    const session = await this.issueSession(user.id);
    return { ok: true, user: toAuthenticatedUser(user), session };
  }

  async login(input: CredentialsInput): Promise<LoginResult> {
    const validation = validateCredentials(input);
    if (!validation.ok) {
      return { ok: false, kind: 'validation', errors: validation.errors };
    }

    const user = await this.repo.findUserByEmail(validation.value.email);
    // ユーザー不在でも常にハッシュ照合を通し、存在有無によるタイミング差・エラー差で
    // メールの登録有無が漏れないようにする（ユーザー列挙対策）。
    const stored =
      user?.passwordHash ??
      'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const matches = await verifyPassword(validation.value.password, stored);
    if (user === null || !matches) {
      return { ok: false, kind: 'invalid_credentials' };
    }

    const session = await this.issueSession(user.id);
    return { ok: true, user: toAuthenticatedUser(user), session };
  }

  /** セッション id から現在のユーザーを解決する。無効・期限切れなら null。 */
  async resolveUser(sessionId: string, now: Date = new Date()): Promise<AuthenticatedUser | null> {
    const session = await this.repo.findValidSession(sessionId, now);
    if (session === null) {
      return null;
    }
    const user = await this.repo.findUserById(session.userId);
    return user === null ? null : toAuthenticatedUser(user);
  }

  /** セッションを破棄する（ログアウト）。 */
  async logout(sessionId: string): Promise<void> {
    await this.repo.deleteSession(sessionId);
  }
}
