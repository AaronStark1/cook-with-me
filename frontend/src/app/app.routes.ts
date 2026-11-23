import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { AllRecipes } from './pages/all-recipes/all-recipes';
import { About } from './pages/about/about';
import { Contact } from './pages/contact/contact';
import { SavedRecipes } from './pages/saved-recipes/saved-recipes';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Profile } from './pages/profile/profile';
import { adminGuard, authGuard } from './guards/auth-guard';

export const routes: Routes = [
  {
    path: 'admin',
    title: 'Admin',
    canMatch: [adminGuard],
    loadChildren: () => import('./admin/admin-module').then(m => m.AdminModule)
  },
  { path: '', title: 'Cook With Me — good food, your way', component: Home },
  { path: 'all-recipes', title: 'Recipes', component: AllRecipes },
  { path: 'about', title: 'About', component: About },
  { path: 'contact', title: 'Contact', component: Contact },
  { path: 'saved-recipes', title: 'My collection', component: SavedRecipes, canActivate: [authGuard] },
  { path: 'login', title: 'Log in', component: Login },
  { path: 'register', title: 'Join', component: Register },
  { path: 'profile', title: 'Profile', component: Profile, canActivate: [authGuard] },
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
