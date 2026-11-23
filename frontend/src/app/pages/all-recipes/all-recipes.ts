import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Apiservice } from '../../services/apiservice';
import { SearchPipe } from '../../pipes/search-pipe';
import { RecipeTile } from '../../components/recipe-tile/recipe-tile';

@Component({
  selector: 'app-all-recipes',
  imports: [FormsModule, SearchPipe, RecipeTile],
  templateUrl: './all-recipes.html',
  styleUrl: './all-recipes.css',
})
export class AllRecipes implements OnInit {
  allRecipes: any[] = []        // everything returned by the API
  recipes: any[] = []           // after the cuisine / meal-type filters
  cuisineType: string[] = []
  mealTypes: string[] = []
  selectedCuisine: string | null = null
  selectedMeal: string | null = null
  searchKey: string = ''
  loading = true
  errorMessage = ''

  constructor(private api: Apiservice) { }

  ngOnInit(): void {
    this.getRecipe()
  }

  getRecipe() {
    this.loading = true
    this.errorMessage = ''
    this.api.getRecipeAPI().subscribe({
      next: (res: any) => {
        this.allRecipes = res.response ?? []
        this.recipes = this.allRecipes
        this.loading = false

        this.cuisineType = [...new Set<string>(this.allRecipes.map(item => item.cuisine))].filter(Boolean)
        this.mealTypes = [...new Set<string>(this.allRecipes.flatMap(item => item.mealType ?? []))].filter(Boolean)
      },
      error: () => {
        this.loading = false
        this.errorMessage = 'Could not load recipes. Please try again later.'
      }
    })
  }

  selectCuisine(cuisine: string | null) {
    this.selectedCuisine = cuisine
    this.applyFilters()
  }

  selectMeal(meal: string | null) {
    this.selectedMeal = meal
    this.applyFilters()
  }

  clearFilters() {
    this.selectedCuisine = null
    this.selectedMeal = null
    this.searchKey = ''
    this.applyFilters()
  }

  get hasActiveFilters(): boolean {
    return !!(this.selectedCuisine || this.selectedMeal || this.searchKey.trim())
  }

  private applyFilters() {
    this.recipes = this.allRecipes.filter(item =>
      // strict equality for cuisine: "Thai" must not match "Thai-fusion"
      (!this.selectedCuisine || item.cuisine === this.selectedCuisine) &&
      (!this.selectedMeal || (Array.isArray(item.mealType) && item.mealType.includes(this.selectedMeal)))
    )
  }

}
