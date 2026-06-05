import type {
  AuthRepository,
  FavoriteRecord,
  FavoriteRepository,
  SessionRecord,
  UserRecord,
} from './repository.js';

/**
 * テスト用のインメモリ実装。Postgres 無しで認証・お気に入りのルートを検証するために使う。
 * 本番では用いない（プロセス内のみで永続化しない）。
 */
export class InMemoryRepository implements AuthRepository, FavoriteRepository {
  private readonly users = new Map<number, UserRecord>();
  private readonly emailIndex = new Map<string, number>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly favorites = new Map<number, Map<number, Date>>();
  private nextUserId = 1;
  private clock = 0;

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const id = this.emailIndex.get(email);
    return id !== undefined ? (this.users.get(id) ?? null) : null;
  }

  async findUserById(id: number): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(email: string, passwordHash: string): Promise<UserRecord | null> {
    if (this.emailIndex.has(email)) {
      return null;
    }
    const user: UserRecord = { id: this.nextUserId++, email, passwordHash };
    this.users.set(user.id, user);
    this.emailIndex.set(email, user.id);
    return user;
  }

  async createSession(id: string, userId: number, expiresAt: Date): Promise<void> {
    this.sessions.set(id, { id, userId, expiresAt });
  }

  async findSession(id: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(id);
    if (session === undefined) {
      return null;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(id);
      return null;
    }
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async addFavorite(userId: number, pokemonId: number): Promise<void> {
    let userFavorites = this.favorites.get(userId);
    if (userFavorites === undefined) {
      userFavorites = new Map();
      this.favorites.set(userId, userFavorites);
    }
    if (!userFavorites.has(pokemonId)) {
      // 追加順を一意に保つため単調増加のクロックを createdAt に使い、新しい順の並びを安定させる。
      userFavorites.set(pokemonId, new Date(++this.clock));
    }
  }

  async removeFavorite(userId: number, pokemonId: number): Promise<void> {
    this.favorites.get(userId)?.delete(pokemonId);
  }

  async listFavorites(userId: number): Promise<readonly FavoriteRecord[]> {
    const userFavorites = this.favorites.get(userId);
    if (userFavorites === undefined) {
      return [];
    }
    return [...userFavorites.entries()]
      .map(([pokemonId, createdAt]) => ({ pokemonId, createdAt }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
