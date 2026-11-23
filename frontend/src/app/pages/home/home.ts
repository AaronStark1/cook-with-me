import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';
import { AuthService } from '../../services/auth';
import { RecipeModel } from '../../models/recipe-model';
import { HeroCarousel, MAX_FEATURED } from '../../components/hero-carousel/hero-carousel';
import { RecipeTile } from '../../components/recipe-tile/recipe-tile';

/** How many recipes the "Cook this week" band shows. */
const TILE_COUNT = 4;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, HeroCarousel, RecipeTile],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {

  approvedTestimonies: any[] = [];

  /** Recipes with a photo, used by the hero carousel. */
  featured: RecipeModel[] = [];
  /** Recipes for the editorial band below the hero. */
  tiles: RecipeModel[] = [];
  recipesLoading = true;
  recipesError = false;

  constructor(private api: Apiservice, protected auth: AuthService) {}

  ngOnInit(): void {
    this.getRecipes();
    this.getApprovedTestimonies();
  }

  getRecipes() {
    this.recipesLoading = true;
    this.recipesError = false;
    this.api.getRecipeAPI().subscribe({
      next: (res: any) => {
        const recipes: RecipeModel[] = (res.response ?? []).filter((r: RecipeModel) => !!r._id && !!r.name);
        // The hero features the first few recipes that have a photo; the band continues from there
        // (or starts over when the library is small) so the two never look identical.
        this.featured = recipes.filter((r) => !!r.image).slice(0, MAX_FEATURED);
        const rest = recipes.slice(MAX_FEATURED);
        this.tiles = (rest.length ? rest : recipes).slice(0, TILE_COUNT);
        this.recipesLoading = false;
      },
      error: () => {
        this.recipesLoading = false;
        this.recipesError = true;
      }
    });
  }

  getApprovedTestimonies() {
    this.api.getApprovedTestimonyAPI().subscribe({
      next: (res: any) => {
        this.approvedTestimonies = res.approved ?? [];
      },
      error: () => {
        // testimonies are optional on the home page — just hide the section content
        this.approvedTestimonies = [];
      }
    });
  }

}
