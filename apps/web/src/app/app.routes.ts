import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'list' },
  {
    path: 'list',
    loadComponent: () => import('./features/list/pokemon-list').then((m) => m.PokemonList),
  },
  {
    path: 'detail/:id',
    loadComponent: () => import('./features/detail/pokemon-detail').then((m) => m.PokemonDetail),
  },
  {
    path: 'favorites',
    loadComponent: () => import('./features/favorites/favorites-page').then((m) => m.FavoritesPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  { path: '**', redirectTo: 'list' },
];
