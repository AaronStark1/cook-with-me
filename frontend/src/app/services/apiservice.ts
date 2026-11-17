import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Apiservice {
  baseURL: string = 'http://localhost:3000'
  constructor(private http: HttpClient) { }
  getRecipeAPI() {
    return this.http.get(`${this.baseURL}/api/allRecipes`)
  }
  registerUserAPI(data: any) {
    return this.http.post(`${this.baseURL}/registration`, data);
  }

  loginAPI(data: any) {
    return this.http.post(`${this.baseURL}/api/login`, data);
  }

  // 🔐 Attach JWT Token
  appendToken() {

    let headers = new HttpHeaders();

    const token = sessionStorage.getItem('token');

    if (token) {
      headers = headers.append('Authorization', `Bearer ${token}`);
    }

    return { headers };
  }
  viewRecipeAPI(id: any) {
    return this.http.get(`${this.baseURL}/api/viewRecipe/${id}`, this.appendToken())
  }

  getRelatedRecipeAPI(cuisine: string) {
    return this.http.get(
      `${this.baseURL}/api/relatedRecipe?cuisine=${cuisine}`,
      this.appendToken()
    );
  }
  getSavedRecipesAPI() {
    return this.http.get(
      `${this.baseURL}/api/getSavedRecipes`,
      this.appendToken()
    );
  }

  deleteSavedRecipeAPI(id: any) {
    return this.http.delete(
      `${this.baseURL}/api/deleteSavedRecipe/${id}`,
      this.appendToken()
    );
  }

  addDownloadAPI(id: any, reqbody: any) {
    return this.http.post(`${this.baseURL}/api/addDownload/${id}`, reqbody, this.appendToken());
  }

  getDownloadAPI() {
    return this.http.get(
      `${this.baseURL}/api/getDownload`,
      this.appendToken()
    );
  }

  deleteDownloadAPI(id: any) {
    return this.http.delete(`${this.baseURL}/api/deleteDownload/${id}`, this.appendToken())
  }
  getAllUsersAPI() {
    return this.http.get(`${this.baseURL}/api/getAllUsers`)
  }

  getDownloadedRecipesListAPI() {
    return this.http.get(
      `${this.baseURL}/api/getDownloadedRecipesList`
    );
  }
  addTestimonyAPI(reqbody: any) {
    return this.http.post(`${this.baseURL}/api/addTestimony`, reqbody, this.appendToken());
  }
  getTestimonyAPI() {
    return this.http.get(`${this.baseURL}/api/getTestimony`);
  }
  getApprovedTestimonyAPI() {
    return this.http.get(`${this.baseURL}/api/getApprovedTestimony`);
  }

  updateTestimonyStatusAPI(id: string, status: string) {
    return this.http.patch(
      `${this.baseURL}/api/updateTestimony/${id}`,
      { status }
    );
  }

  addRecipeAPI(reqbody: any) {
    return this.http.post(`${this.baseURL}/api/addRecipe`, reqbody);
  }
  updateRecipeAPI(id:any,reqbody: any) {
    return this.http.put(`${this.baseURL}/api/updateRecipe/${id}`, reqbody);
  }
    deleteRecipeAPI(id:any) {
    return this.http.delete(`${this.baseURL}/api/deleteRecipe/${id}`);
  }
}
