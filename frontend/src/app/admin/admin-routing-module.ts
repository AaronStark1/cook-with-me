import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { RecipeList } from './recipe-list/recipe-list';
import { AdminLayout } from './admin-layout/admin-layout';
import { DownloadList } from './download-list/download-list';
import { ManageRecipe } from './manage-recipe/manage-recipe';
import { UsersList } from './users-list/users-list';
import { RequestList } from './request-list/request-list';

const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', component: Dashboard },
      { path: 'recipelist', component: RecipeList },
      { path: 'userslist', component: UsersList },
      { path: 'downloadlist', component: DownloadList },
      { path: 'requestlist', component: RequestList },
      { path: 'recipe/add', component: ManageRecipe },
      { path: 'recipe/edit/:id', component: ManageRecipe }
    ]
  }
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
