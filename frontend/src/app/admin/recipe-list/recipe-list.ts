import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';
import { SearchPipe } from '../../pipes/search-pipe';
import { ImgFallback } from '../../directives/img-fallback';

@Component({
  selector: 'app-recipe-list',
  standalone: true,
  imports: [FormsModule, RouterLink, SearchPipe, ImgFallback],
  templateUrl: './recipe-list.html',
  styleUrl: './recipe-list.css'
})
export class RecipeList implements OnInit {

  recipes: any[] = [];
  searchKey = '';
  loading = true;
  errorMessage = '';

  constructor(private api: Apiservice) {}

  ngOnInit(): void {
    this.getAllRecipes();
  }

  getAllRecipes() {
    this.api.getRecipeAPI().subscribe({
      next: (res: any) => {
        this.recipes = res.response ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load recipes. Please try again.';
      }
    });
  }

  deleteRecipe(id: string) {

    if (!confirm("Are you sure you want to delete this recipe?")) {
      return;
    }

    this.errorMessage = '';
    this.api.deleteRecipeAPI(id).subscribe({
      next: () => this.getAllRecipes(), // refresh list
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Could not delete the recipe.';
      }
    });
  }

}
