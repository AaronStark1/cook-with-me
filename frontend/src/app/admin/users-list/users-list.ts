import { Component, OnInit } from '@angular/core';
import { Apiservice } from '../../services/apiservice';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-users-list',
  imports: [CommonModule],
  templateUrl: './users-list.html',
  styleUrl: './users-list.css',
})
export class UsersList implements OnInit{
  users: any= [];
  constructor(private api:Apiservice){}
  ngOnInit(): void {
    this.getAllUsers()
  }
  getAllUsers(){
    this.api.getAllUsersAPI().subscribe({
      next:(res:any)=>{
        console.log(res);
        this.users = res; 
      },
      error:(err)=>{
        console.log(err);
        
      }
    })
  }
}
