import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Apiservice } from '../../services/apiservice';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-saved-recipes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './saved-recipes.html',
  styleUrl: './saved-recipes.css',
})
export class SavedRecipes implements OnInit {

  savedRecipes: any[] = [];

  constructor(private api: Apiservice) {}

  ngOnInit(): void {
    this.getSavedRecipes();
  }

  getSavedRecipes() {
    this.api.getSavedRecipesAPI().subscribe({
      next: (res: any) => {
        console.log(res);
        this.savedRecipes = res;
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

  removeRecipe(id: string) {

    this.api.deleteSavedRecipeAPI(id).subscribe({
      next: () => {

        // Remove from UI instantly
        this.savedRecipes = this.savedRecipes.filter(
          recipe => recipe._id !== id
        );

      },
      error: (err) => {
        console.log(err);
      }
    });

  }

}
