import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Apiservice } from '../../services/apiservice';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {

  profileForm!: FormGroup;
  downloadedRecipes: any[] = [];
  userDetails: any = {};

  constructor(
    private fb: FormBuilder,
    private api: Apiservice
  ) {}

  ngOnInit(): void {

    // Get user from session
    const userData = sessionStorage.getItem('userDetails');
    if (userData) {
      this.userDetails = JSON.parse(userData);
    }

    this.profileForm = this.fb.group({
      username: [this.userDetails?.username || '', Validators.required],
      email: [this.userDetails?.email || '', [Validators.required, Validators.email]]
    });

    this.getDownloadedRecipes();
  }

  updateProfile() {
    if (this.profileForm.invalid) return;

    // For now just update sessionStorage
    sessionStorage.setItem('userDetails', JSON.stringify(this.profileForm.value));
    alert("Profile Updated");
  }

  getDownloadedRecipes() {
    this.api.getDownloadAPI().subscribe({
      next: (res: any) => {
        this.downloadedRecipes = res;
      },
      error: (err) => {
        console.log(err);
      }
    });
  }

  deleteDownloadedRecipe(id:any){
    this.api.deleteDownloadAPI(id).subscribe({
      next: (res:any) => {
        console.log(res);
        this.getDownloadedRecipes()
      },
      error:(err) => {
        console.log(err);
        
      }
    })
  }

}
