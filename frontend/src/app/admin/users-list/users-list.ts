import { Component, OnInit } from '@angular/core';
import { Apiservice } from '../../services/apiservice';

@Component({
  selector: 'app-users-list',
  imports: [],
  templateUrl: './users-list.html',
  styleUrl: './users-list.css',
})
export class UsersList implements OnInit {
  users: any[] = [];
  loading = true;
  errorMessage = '';

  constructor(private api: Apiservice) {}

  ngOnInit(): void {
    this.getAllUsers()
  }

  getAllUsers() {
    this.api.getAllUsersAPI().subscribe({
      next: (res: any) => {
        this.users = res;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load users. Please try again.';
      }
    })
  }
}
