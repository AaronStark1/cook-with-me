import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { adminGuard, authGuard } from './guards/auth-guard';

// Only the shell and the home page ship in the initial bundle; every other route is its own chunk.
export const routes: Routes = [
  {
    path: 'admin',
    title: 'Admin',
    canMatch: [adminGuard],
    loadChildren: () => import('./admin/admin-module').then(m => m.AdminModule)
  },
  { path: '', title: 'Cook With Me — good food, your way', component: Home },
  {
    path: 'all-recipes',
    title: 'Recipes',
    loadComponent: () => import('./pages/all-recipes/all-recipes').then(m => m.AllRecipes)
  },
  { path: 'about', title: 'About', loadComponent: () => import('./pages/about/about').then(m => m.About) },
  { path: 'contact', title: 'Contact', loadComponent: () => import('./pages/contact/contact').then(m => m.Contact) },
  {
    path: 'saved-recipes',
    title: 'My collection',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/saved-recipes/saved-recipes').then(m => m.SavedRecipes)
  },
  { path: 'login', title: 'Log in', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  { path: 'register', title: 'Join', loadComponent: () => import('./pages/register/register').then(m => m.Register) },
  {
    path: 'profile',
    title: 'Profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/profile/profile').then(m => m.Profile)
  },
  {
    path: 'view-recipe/:id',
    title: 'Recipe',
    loadComponent: () => import('./pages/view-recipe/view-recipe').then(m => m.ViewRecipe)
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFound)
  }
];
