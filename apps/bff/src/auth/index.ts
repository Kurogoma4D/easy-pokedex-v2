export { AuthService } from './service.js';
export type { AuthenticatedUser, LoginResult, RegisterResult, SessionIssue } from './service.js';
export { createPgAuthRepository } from './pg-repository.js';
export { createMemoryAuthRepository } from './memory-repository.js';
export type { AuthRepository, SessionRecord, UserRecord } from './repository.js';
export { DuplicateEmailError } from './repository.js';
export { requireAuth, sessionResolver } from './middleware.js';
export type { AuthVariables } from './middleware.js';
export {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  getSessionCookie,
  setSessionCookie,
} from './session.js';
export { hashPassword, verifyPassword } from './password.js';
export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validateCredentials } from './validation.js';
export type { FieldError } from './validation.js';
