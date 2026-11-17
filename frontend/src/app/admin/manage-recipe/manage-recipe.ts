import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Apiservice } from '../../services/apiservice';
import { RecipeModel } from '../../models/recipe-model';

@Component({
  selector: 'app-manage-recipe',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-recipe.html',
  styleUrl: './manage-recipe.css',
})
export class ManageRecipe implements OnInit {

  recipeDetails: RecipeModel = {};
  ingredientsArray: string[] = [];
  instructionsArray: string[] = [];
  mealTypeArray: string[] = [];
  cuisineArray: string[] = [];

  recipeId: string = "";
  recipes: any[] = [];

  constructor(
    private api: Apiservice,
    private ar: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {

    // Get route param first
    this.ar.params.subscribe((res: any) => {
      this.recipeId = res['id'] || "";
      this.getAllRecipes();
    });

  }

  // ==============================
  // LOAD ALL RECIPES
  // ==============================

  getAllRecipes() {

    this.api.getRecipeAPI().subscribe({
      next: (res: any) => {

        this.recipes = res.response || [];

        // Populate cuisine dropdown
        this.recipes.forEach((item: any) => {
          if (!this.cuisineArray.includes(item.cuisine)) {
            this.cuisineArray.push(item.cuisine);
          }
        });

        // If Edit Mode → Load Recipe
        if (this.recipeId) {

          const selectedRecipe = this.recipes.find(
            (item: any) => item._id === this.recipeId
          );

          if (selectedRecipe) {

            this.recipeDetails = { ...selectedRecipe };

            this.ingredientsArray = [...(selectedRecipe.ingredients || [])];
            this.instructionsArray = [...(selectedRecipe.instructions || [])];
            this.mealTypeArray = [...(selectedRecipe.mealType || [])];
          }
        }

      },
      error: (err) => {
        console.log("Error loading recipes", err);
      }
    });
  }

  // ==============================
  // INGREDIENTS
  // ==============================

  addIngredients(input: any) {
    if (input.value.trim()) {
      this.ingredientsArray.push(input.value.trim());
      input.value = "";
    }
  }

  deleteIngredients(index: number) {
    this.ingredientsArray.splice(index, 1);
  }

  // ==============================
  // INSTRUCTIONS
  // ==============================

  addInstructions(input: any) {
    if (input.value.trim()) {
      this.instructionsArray.push(input.value.trim());
      input.value = "";
    }
  }

  deleteInstructions(index: number) {
    this.instructionsArray.splice(index, 1);
  }

  // ==============================
  // MEAL TYPE
  // ==============================

  addMeal(input: any) {
    if (input.value.trim() && !this.mealTypeArray.includes(input.value.trim())) {
      this.mealTypeArray.push(input.value.trim());
      input.value = "";
    }
  }

  removeMeal(meal: string) {
    this.mealTypeArray = this.mealTypeArray.filter(item => item !== meal);
  }

  // ==============================
  // ADD RECIPE
  // ==============================

  addRecipe() {

    this.recipeDetails.ingredients = this.ingredientsArray;
    this.recipeDetails.instructions = this.instructionsArray;
    this.recipeDetails.mealType = this.mealTypeArray;

    this.api.addRecipeAPI(this.recipeDetails).subscribe({
      next: (res: any) => {
        alert("Recipe Added Successfully");
        this.router.navigateByUrl('/admin/recipelist');
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

  // ==============================
  // EDIT RECIPE
  // ==============================

  editRecipe() {

    this.recipeDetails.ingredients = this.ingredientsArray;
    this.recipeDetails.instructions = this.instructionsArray;
    this.recipeDetails.mealType = this.mealTypeArray;

    this.api.updateRecipeAPI(this.recipeId, this.recipeDetails).subscribe({
      next: (res: any) => {
        alert("Recipe Updated Successfully");
        this.router.navigateByUrl('/admin/recipelist');
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

}
