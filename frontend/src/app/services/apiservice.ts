import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { RecipeModel } from '../models/recipe-model';

/**
 * Thin wrapper over the REST API. The bearer token is attached (and 401s are
 * handled) centrally by `authInterceptor`, so nothing here deals with auth.
 */
@Injectable({
  providedIn: 'root',
})
export class Apiservice {
  readonly baseURL: string = environment.apiUrl

  constructor(private http: HttpClient) { }

  // ---- Auth / profile
  registerUserAPI(data: any) {
    return this.http.post(`${this.baseURL}/api/registration`, data);
  }

  loginAPI(data: any) {
    return this.http.post(`${this.baseURL}/api/login`, data);
  }

  updateProfileAPI(data: { username: string; email: string }) {
    return this.http.patch(`${this.baseURL}/api/updateProfile`, data);
  }

  // ---- Recipes
  getRecipeAPI() {
    return this.http.get(`${this.baseURL}/api/allRecipes`)
  }

  viewRecipeAPI(id: string) {
    return this.http.get<RecipeModel>(`${this.baseURL}/api/viewRecipe/${encodeURIComponent(id)}`)
  }

  getRelatedRecipeAPI(cuisine: string) {
    const params = new HttpParams().set('cuisine', cuisine);
    return this.http.get<RecipeModel[]>(`${this.baseURL}/api/relatedRecipe`, { params });
  }

  addRecipeAPI(reqbody: any) {
    return this.http.post(`${this.baseURL}/api/addRecipe`, reqbody);
  }

  updateRecipeAPI(id: string, reqbody: any) {
    return this.http.put(`${this.baseURL}/api/updateRecipe/${encodeURIComponent(id)}`, reqbody);
  }

  deleteRecipeAPI(id: string) {
    return this.http.delete(`${this.baseURL}/api/deleteRecipe/${encodeURIComponent(id)}`);
  }

  // ---- Saved recipes
  saveRecipeAPI(id: string) {
    // name/image are taken from the recipe catalogue server-side
    return this.http.post(`${this.baseURL}/api/savedRecipe/${encodeURIComponent(id)}`, {});
  }

  getSavedRecipesAPI() {
    return this.http.get(`${this.baseURL}/api/getSavedRecipes`);
  }

  deleteSavedRecipeAPI(id: string) {
    return this.http.delete(`${this.baseURL}/api/deleteSavedRecipe/${encodeURIComponent(id)}`);
  }

  // ---- Downloads
  addDownloadAPI(id: string) {
    return this.http.post(`${this.baseURL}/api/addDownload/${encodeURIComponent(id)}`, {});
  }

  getDownloadAPI() {
    return this.http.get(`${this.baseURL}/api/getDownload`);
  }

  deleteDownloadAPI(id: string) {
    return this.http.delete(`${this.baseURL}/api/deleteDownload/${encodeURIComponent(id)}`)
  }

  // ---- Admin
  getAllUsersAPI() {
    return this.http.get(`${this.baseURL}/api/getAllUsers`)
  }

  getDownloadedRecipesListAPI() {
    return this.http.get(`${this.baseURL}/api/getDownloadedRecipesList`);
  }

  // ---- Testimonies
  addTestimonyAPI(reqbody: { message: string; profession: string }) {
    return this.http.post(`${this.baseURL}/api/addTestimony`, reqbody);
  }

  getTestimonyAPI() {
    return this.http.get(`${this.baseURL}/api/getTestimony`);
  }

  getApprovedTestimonyAPI() {
    return this.http.get(`${this.baseURL}/api/getApprovedTestimony`);
  }

  updateTestimonyStatusAPI(id: string, status: string) {
    return this.http.patch(`${this.baseURL}/api/updateTestimony/${encodeURIComponent(id)}`, { status });
  }
}
