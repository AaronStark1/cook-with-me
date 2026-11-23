import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { Apiservice } from '../../services/apiservice';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  // null = could not be loaded (shown as "—" instead of a misleading 0)
  users: number | null = null;
  recipes: number | null = null;
  downloads: number | null = null;
  pendingRequests: number | null = null;
  topDownloads: any[] = [];
  loading = true;

  constructor(private api: Apiservice) { }

  ngOnInit(): void {
    // one failing endpoint should not blank the whole dashboard
    const safe = <T>(source: Observable<T>) => source.pipe(catchError(() => of(null)));

    forkJoin({
      users: safe(this.api.getAllUsersAPI()),
      recipes: safe(this.api.getRecipeAPI()),
      downloads: safe(this.api.getDownloadedRecipesListAPI()),
      testimonies: safe(this.api.getTestimonyAPI())
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((res: any) => {
      this.users = Array.isArray(res.users) ? res.users.length : null;
      this.recipes = Array.isArray(res.recipes?.response) ? res.recipes.response.length : null;

      const downloads: any[] | null = Array.isArray(res.downloads?.downloads) ? res.downloads.downloads : null;
      this.downloads = downloads ? downloads.reduce((sum, d) => sum + (d.count ?? 0), 0) : null;
      this.topDownloads = (downloads ?? []).slice(0, 5);

      const testimonies: any[] | null = Array.isArray(res.testimonies?.allTestimony) ? res.testimonies.allTestimony : null;
      this.pendingRequests = testimonies ? testimonies.filter(t => !t.status || t.status === 'Pending').length : null;

      this.loading = false;
    });
  }
}
