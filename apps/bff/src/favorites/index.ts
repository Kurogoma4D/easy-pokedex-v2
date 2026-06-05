export { FavoriteService } from './service.js';
export type { AddFavoriteResult, FavoriteItem, RemoveFavoriteResult } from './service.js';
export { createPgFavoriteRepository } from './pg-repository.js';
export { createMemoryFavoriteRepository } from './memory-repository.js';
export type { FavoriteRecord, FavoriteRepository } from './repository.js';
