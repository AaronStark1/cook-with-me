import { Component, ElementRef, HostListener, OnInit, ViewContainerRef, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Apiservice } from '../../services/apiservice';
import { SearchPipe } from '../../pipes/search-pipe';
import { RecipeTile } from '../../components/recipe-tile/recipe-tile';
import { Odometer } from '../../components/odometer/odometer';
import { openSurprise } from '../../components/spin-overlay/open-surprise';
import { Reveal } from '../../motion/reveal';
import { Flip } from '../../motion/flip';
import { TypedPlaceholder } from '../../motion/typed-placeholder';

@Component({
  selector: 'app-all-recipes',
  imports: [FormsModule, RecipeTile, Odometer, Reveal, Flip, TypedPlaceholder],
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

  /** Placeholder tiles shown while the library loads. */
  protected readonly skeletons = Array.from({ length: 8 }, (_, i) => i)
  /** Real cuisines and meal types, typed out as search examples. */
  protected searchExamples: string[] = []

  private readonly search = new SearchPipe()
  private readonly host = inject(ViewContainerRef)
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox')
  private visibleCache: { recipes: any[]; key: string; out: any[] } | null = null

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
        this.searchExamples = [...this.cuisineType, ...this.mealTypes].slice(0, 8)
      },
      error: () => {
        this.loading = false
        this.errorMessage = 'Could not load recipes. Please try again later.'
      }
    })
  }

  /** What is on screen: the filtered list narrowed by the live search (same rules as the `search` pipe). */
  get visible(): any[] {
    const cache = this.visibleCache
    if (cache && cache.recipes === this.recipes && cache.key === this.searchKey) return cache.out
    const out = this.search.transform(this.recipes, this.searchKey)
    this.visibleCache = { recipes: this.recipes, key: this.searchKey, out }
    return out
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

  clearSearch() {
    this.searchKey = ''
    this.searchBox()?.nativeElement.focus()
  }

  get hasActiveFilters(): boolean {
    return !!(this.selectedCuisine || this.selectedMeal || this.searchKey.trim())
  }

  /** "/" jumps to the search box — unless the user is already typing somewhere. */
  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent) {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target as HTMLElement | null
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
    const box = this.searchBox()?.nativeElement
    if (!box) return
    event.preventDefault()
    box.focus()
  }

  /** Escape clears the search while it has focus. */
  protected onSearchEscape(event: Event) {
    if (!this.searchKey) return
    event.preventDefault()
    this.searchKey = ''
  }

  /** Spin the platter: a random pick from whatever is currently visible. */
  protected surprise() {
    if (this.visible.length) openSurprise(this.host, this.visible)
  }

  private applyFilters() {
    this.recipes = this.allRecipes.filter(item =>
      // strict equality for cuisine: "Thai" must not match "Thai-fusion"
      (!this.selectedCuisine || item.cuisine === this.selectedCuisine) &&
      (!this.selectedMeal || (Array.isArray(item.mealType) && item.mealType.includes(this.selectedMeal)))
    )
  }

}
