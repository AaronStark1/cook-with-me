import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Apiservice } from '../../services/apiservice';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {

  approvedTestimonies: any[] = [];

  constructor(private api: Apiservice) {}

  ngOnInit(): void {
    this.getApprovedTestimonies();
  }

  getApprovedTestimonies() {
    this.api.getApprovedTestimonyAPI().subscribe({
      next: (res: any) => {
        console.log(res);
        this.approvedTestimonies = res.approved;
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

}
