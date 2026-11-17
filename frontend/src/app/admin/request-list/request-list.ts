import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Apiservice } from '../../services/apiservice';

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './request-list.html',
  styleUrl: './request-list.css'
})
export class RequestList implements OnInit {

  testimonyList: any[] = [];

  constructor(private api: Apiservice) { }

  ngOnInit(): void {
    this.getAllTestimonies();
  }

  getAllTestimonies() {
    this.api.getTestimonyAPI().subscribe({
      next: (res: any) => {
        console.log(res);
        this.testimonyList = res.allTestimony;
      },
      error: (err) => {
        console.log("API Error", err);
      }
    });
  }

  approveTestimony(id: string) {
    this.api.updateTestimonyStatusAPI(id, 'Approved').subscribe({
      next: () => {
        this.getAllTestimonies();
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

  rejectTestimony(id: string) {
    this.api.updateTestimonyStatusAPI(id, 'Rejected').subscribe({
      next: () => {
        this.getAllTestimonies();
      },
      error: (err) => {
        console.log(err);
      }
    });
  }


}
