/**
 * フロントエンドの認証状態管理。
 *
 * BFF の `/auth/*`（Part 2 で実装済み）を叩き、現在ユーザーを signal として公開する。
 * 認証セッションは HttpOnly Cookie で運ばれるため、すべてのリクエストを
 * `withCredentials: true` で送り、Cookie の送受信を許可する。アプリ起動時に一度
 * `/auth/me` を叩いてログイン状態を復元する（既存セッション Cookie があれば自動でログイン状態になる）。
 */

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../core/api-base-url';
import type { AuthErrorResponse, AuthUser, AuthUserResponse, Credentials } from './auth.model';

/**
 * 登録・ログインの結果。失敗時はフロントの文言キーへ写像できる種別を返す。
 * バリデーション失敗は BFF の `details`（フィールド単位エラー）に基づき、
 * email/password のどちらが不正かを区別して文言を出し分けられるようにする。
 */
export type AuthActionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly kind:
        | 'validation_email'
        | 'validation_password'
        | 'validation'
        | 'invalid_credentials'
        | 'duplicate'
        | 'unknown';
    };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private readonly _user = signal<AuthUser | null>(null);
  /** ログイン中ユーザー。未ログインなら null。 */
  readonly user = this._user.asReadonly();
  /** ログイン済みか。 */
  readonly isAuthenticated = computed(() => this._user() !== null);

  // 起動直後の `/auth/me` 解決が完了するまでは true。導線の点滅（未ログイン表示→ログイン表示）を避けるため公開する。
  private readonly _initializing = signal(true);
  readonly initializing = this._initializing.asReadonly();

  /** 既存セッション Cookie から現在ユーザーを復元する。未認証なら null のままにする。 */
  async restoreSession(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<AuthUserResponse>(`${this.baseUrl}/auth/me`, { withCredentials: true }),
      );
      this._user.set(res.user);
    } catch {
      // 401（未認証）を含め、復元できなければ未ログインとして扱う。
      this._user.set(null);
    } finally {
      this._initializing.set(false);
    }
  }

  async register(credentials: Credentials): Promise<AuthActionResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<AuthUserResponse>(`${this.baseUrl}/auth/register`, credentials, {
          withCredentials: true,
        }),
      );
      this._user.set(res.user);
      return { ok: true };
    } catch (error) {
      return this.toFailure(error, { 409: 'duplicate' });
    }
  }

  async login(credentials: Credentials): Promise<AuthActionResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<AuthUserResponse>(`${this.baseUrl}/auth/login`, credentials, {
          withCredentials: true,
        }),
      );
      this._user.set(res.user);
      return { ok: true };
    } catch (error) {
      return this.toFailure(error, { 401: 'invalid_credentials' });
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/auth/logout`, null, { withCredentials: true }),
      );
    } catch {
      // ログアウトはサーバ応答に関わらずクライアント状態を未ログインへ倒す。
    } finally {
      this._user.set(null);
    }
  }

  /**
   * HTTP エラーをアクション失敗種別へ写像する。
   * 400 はバリデーション失敗として `details`（フィールド単位エラー）を見て email/password を区別する。
   * email と password の両方が不正なときは email を優先し、フィールド不明なら汎用の validation に倒す。
   * マップにも該当しないステータスは unknown とする。
   */
  private toFailure(
    error: unknown,
    statusMap: Readonly<Record<number, 'invalid_credentials' | 'duplicate'>>,
  ): AuthActionResult {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) {
        return { ok: false, kind: this.validationKind(error.error as AuthErrorResponse | null) };
      }
      const kind = statusMap[error.status];
      if (kind !== undefined) {
        return { ok: false, kind };
      }
    }
    return { ok: false, kind: 'unknown' };
  }

  /** バリデーション失敗本文のフィールド種別を、表示文言と対応する種別へ写像する。 */
  private validationKind(
    body: AuthErrorResponse | null,
  ): 'validation_email' | 'validation_password' | 'validation' {
    const fields = body?.details?.map((detail) => detail.field) ?? [];
    if (fields.includes('email')) {
      return 'validation_email';
    }
    if (fields.includes('password')) {
      return 'validation_password';
    }
    return 'validation';
  }
}
