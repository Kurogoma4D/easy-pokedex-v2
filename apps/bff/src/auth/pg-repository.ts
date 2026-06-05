import type { Pool } from 'pg';

import type {
  AuthRepository,
  FavoriteRecord,
  FavoriteRepository,
  SessionRecord,
  UserRecord,
} from './repository.js';

/** Postgres の UNIQUE 制約違反コード。メール重複の判別に使う。 */
const UNIQUE_VIOLATION = '23505';

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string;
}

interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly expires_at: Date;
}

interface FavoriteRow {
  readonly pokemon_id: number;
  readonly created_at: Date;
}

function toUser(row: UserRow): UserRecord {
  return { id: Number(row.id), email: row.email, passwordHash: row.password_hash };
}

export class PgAuthRepository implements AuthRepository {
  constructor(private readonly pool: Pool) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    const row = result.rows[0];
    return row ? toUser(row) : null;
  }

  async findUserById(id: number): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT id, email, password_hash FROM users WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    return row ? toUser(row) : null;
  }

  async createUser(email: string, passwordHash: string): Promise<UserRecord | null> {
    try {
      const result = await this.pool.query<UserRow>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, password_hash',
        [email, passwordHash],
      );
      return toUser(result.rows[0]!);
    } catch (error) {
      if (error instanceof Error && (error as { code?: string }).code === UNIQUE_VIOLATION) {
        return null;
      }
      throw error;
    }
  }

  async createSession(id: string, userId: number, expiresAt: Date): Promise<void> {
    await this.pool.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [
      id,
      userId,
      expiresAt,
    ]);
  }

  async findSession(id: string): Promise<SessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      'SELECT id, user_id, expires_at FROM sessions WHERE id = $1 AND expires_at > now()',
      [id],
    );
    const row = result.rows[0];
    return row ? { id: row.id, userId: Number(row.user_id), expiresAt: row.expires_at } : null;
  }

  async deleteSession(id: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE id = $1', [id]);
  }
}

export class PgFavoriteRepository implements FavoriteRepository {
  constructor(private readonly pool: Pool) {}

  async addFavorite(userId: number, pokemonId: number): Promise<void> {
    await this.pool.query(
      'INSERT INTO favorites (user_id, pokemon_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, pokemonId],
    );
  }

  async removeFavorite(userId: number, pokemonId: number): Promise<void> {
    await this.pool.query('DELETE FROM favorites WHERE user_id = $1 AND pokemon_id = $2', [
      userId,
      pokemonId,
    ]);
  }

  async listFavorites(userId: number): Promise<readonly FavoriteRecord[]> {
    const result = await this.pool.query<FavoriteRow>(
      'SELECT pokemon_id, created_at FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map((row) => ({ pokemonId: row.pokemon_id, createdAt: row.created_at }));
  }
}
