import { Hono } from 'hono';

import { PokeApiClient } from './pokeapi/index.js';
import { createPokemonRoutes } from './routes/pokemon.js';

/** アプリ全体で共有する単一の PokeApiClient。キャッシュ・単一フライトをプロセス内で共有する。 */
const pokeApiClient = new PokeApiClient();

export const app = new Hono();

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'bff',
    timestamp: new Date().toISOString(),
  }),
);

app.route('/pokemon', createPokemonRoutes(pokeApiClient));
