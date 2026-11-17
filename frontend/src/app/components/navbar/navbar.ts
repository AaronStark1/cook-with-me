import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {

  token: string | null = null;
  userDetails: any = {};

  ngOnInit(): void {

    this.token = sessionStorage.getItem('token');

    const userData = sessionStorage.getItem('userDetails');

    if (userData) {
      this.userDetails = JSON.parse(userData);
    }

    console.log(this.token, this.userDetails);
  }

  logout() {
    sessionStorage.clear();
    window.location.reload();
  }
}
