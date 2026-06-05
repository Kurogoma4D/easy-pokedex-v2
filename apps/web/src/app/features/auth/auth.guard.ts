import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * ログイン必須ルートのガード。セッション復元（`restoreSession`）の完了を待ってから判定し、
 * 未ログインならログイン画面へ誘導する。戻り先として要求 URL を `redirect` で渡す。
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.initialized()) {
    await auth.restoreSession();
  }

  if (auth.user() !== null) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};
