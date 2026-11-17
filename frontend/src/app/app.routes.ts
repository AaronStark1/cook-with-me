import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { AllRecipes } from './pages/all-recipes/all-recipes';
import { About } from './pages/about/about';
import { Contact } from './pages/contact/contact';
import { SavedRecipes } from './pages/saved-recipes/saved-recipes';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Profile } from './pages/profile/profile';

export const routes: Routes = [
    {
        path:'admin' , loadChildren:()=>import('./admin/admin-module').then(m=>m.AdminModule)
    },
    {path:'',component: Home},
    { path: 'all-recipes', component: AllRecipes },
    { path: 'about', component: About },
    {path:'contact',component:Contact},
    {path:'saved-recipes',component:SavedRecipes},
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  {path:'profile', component:Profile},
  {
  path: 'view-recipe/:id',
  loadComponent: () =>
    import('./pages/view-recipe/view-recipe')
      .then(m => m.ViewRecipe)
}

];
