import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import type { AuthErrorKind, AuthUser } from './auth.model';

interface AuthUserResponse {
  readonly user: AuthUser;
}

/**
 * 認証状態の管理（FR: 認証状態の管理）。BFF の `/auth/*` を叩き、現在ユーザーを signal で公開する。
 *
 * セッションは HttpOnly Cookie で維持されるため、すべての要求を `withCredentials: true` で送る。
 * トークンをフロントで保持せず、現在ユーザーは起動時の `/auth/me` と各操作の結果から復元する。
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private readonly _user = signal<AuthUser | null>(null);
  /** 現在ログイン中のユーザー。未ログインは null。 */
  readonly user = this._user.asReadonly();

  /** 起動時のセッション復元が完了したか。ガードはこれを待ってから判定する。 */
  private readonly _initialized = signal(false);
  readonly initialized = this._initialized.asReadonly();

  /** セッション Cookie から現在ユーザーを復元する。未ログインなら null のまま完了する。 */
  async restoreSession(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<AuthUserResponse>(`${this.baseUrl}/auth/me`, { withCredentials: true }),
      );
      this._user.set(res.user);
    } catch {
      this._user.set(null);
    } finally {
      this._initialized.set(true);
    }
  }

  /** アカウント登録。成功時に現在ユーザーを更新する。 */
  async register(email: string, password: string): Promise<void> {
    await this.submit('register', email, password);
  }

  /** ログイン。成功時に現在ユーザーを更新する。 */
  async login(email: string, password: string): Promise<void> {
    await this.submit('login', email, password);
  }

  /** ログアウト。セッションを破棄して現在ユーザーを null にする。 */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/auth/logout`, null, { withCredentials: true }),
      );
    } finally {
      this._user.set(null);
    }
  }

  private async submit(path: 'register' | 'login', email: string, password: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<AuthUserResponse>(
          `${this.baseUrl}/auth/${path}`,
          { email, password },
          { withCredentials: true },
        ),
      );
      this._user.set(res.user);
    } catch (error) {
      throw toAuthError(error);
    }
  }
}

/** 認証エラーを呼び出し側が出し分けられる種別へ写像する。 */
class AuthError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind);
  }
}

function toAuthError(error: unknown): AuthError {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 409) {
      return new AuthError('email_taken');
    }
    if (error.status === 401) {
      return new AuthError('invalid_credentials');
    }
    if (error.status === 400) {
      return new AuthError('invalid_input');
    }
  }
  return new AuthError('network');
}

export { AuthError };
