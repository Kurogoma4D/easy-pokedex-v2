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
  { path: '**', redirectTo: 'list' },
];
