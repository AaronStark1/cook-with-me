import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Apiservice } from '../../services/apiservice';

@Component({
  selector: 'app-recipe-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './recipe-list.html',
  styleUrl: './recipe-list.css'
})
export class RecipeList implements OnInit {

  recipes: any[] = [];

  constructor(
    private api: Apiservice,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.getAllRecipes();
  }

  getAllRecipes() {
    this.api.getRecipeAPI().subscribe({
      next: (res: any) => {
        console.log(res);
        this.recipes = res.response; // from backend
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

  deleteRecipe(id: string) {

    if (!confirm("Are you sure you want to delete this recipe?")) {
      return;
    }

    this.api.deleteRecipeAPI(id).subscribe({
      next: () => {
        alert("Recipe deleted successfully");
        this.getAllRecipes(); // refresh list
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

}
