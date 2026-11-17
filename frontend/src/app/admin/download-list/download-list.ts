import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Apiservice } from '../../services/apiservice';

@Component({
  selector: 'app-download-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './download-list.html',
  styleUrl: './download-list.css'
})
export class DownloadList implements OnInit {

  downloadList: any[] = [];

  constructor(private api: Apiservice) {}

  ngOnInit(): void {
    this.getDownloadedRecipesList();
  }

  getDownloadedRecipesList() {
    this.api.getDownloadedRecipesListAPI().subscribe({
      next: (res: any) => {
        console.log(res);
        this.downloadList = res.downloads;
      },
      error: (err) => {
        console.log("API error", err);
      }
    });
  }
}
