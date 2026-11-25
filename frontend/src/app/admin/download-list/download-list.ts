import { Component, OnInit } from '@angular/core';
import { Apiservice } from '../../services/apiservice';
import { RowsIn } from '../row-motion';

@Component({
  selector: 'app-download-list',
  standalone: true,
  imports: [RowsIn],
  templateUrl: './download-list.html',
  styleUrl: './download-list.css'
})
export class DownloadList implements OnInit {

  downloadList: any[] = [];
  loading = true;
  errorMessage = '';

  constructor(private api: Apiservice) {}

  ngOnInit(): void {
    this.getDownloadedRecipesList();
  }

  getDownloadedRecipesList() {
    this.api.getDownloadedRecipesListAPI().subscribe({
      next: (res: any) => {
        this.downloadList = res.downloads ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load downloads. Please try again.';
      }
    });
  }
}
