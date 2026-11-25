import { Component, ViewContainerRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';
import { RecipeModel } from '../../models/recipe-model';
import { openSurprise } from '../../components/spin-overlay/open-surprise';
import { ToastService } from '../../components/toasts/toast.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
})
export class NotFound {
  private readonly api = inject(Apiservice);
  private readonly host = inject(ViewContainerRef);
  private readonly toasts = inject(ToastService);
  protected loading = false;

  /** A lost visitor can spin the platter instead: a random pick from the real recipe library. */
  protected surprise() {
    if (this.loading) return;
    this.loading = true;
    this.api.getRecipeAPI().subscribe({
      next: (res: any) => {
        this.loading = false;
        const recipes: RecipeModel[] = (res?.response ?? []).filter((r: RecipeModel) => !!r._id && !!r.name);
        if (recipes.length) openSurprise(this.host, recipes);
        else this.toasts.show('There are no recipes to choose from yet');
      },
      error: () => {
        this.loading = false;
        this.toasts.error('Could not load recipes. Please try again.');
      },
    });
  }
}
