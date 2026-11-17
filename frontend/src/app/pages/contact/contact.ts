import { Component, OnInit } from '@angular/core';
import { Apiservice } from '../../services/apiservice';
import { FormsModule } from "@angular/forms";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-contact',
  imports: [FormsModule,CommonModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact implements OnInit {
  constructor(private api: Apiservice) { }
  ngOnInit(): void {

  }
  testimonyData: any = {
    username: '',
    email: '',
    message: '',
    profession: ''
  }

addTestimony() {

  if (!this.testimonyData.username ||
      !this.testimonyData.email ||
      !this.testimonyData.message ||
      !this.testimonyData.profession) {

    alert("Please fill all fields");
    return;
  }

  this.api.addTestimonyAPI(this.testimonyData).subscribe({

    next: (res: any) => {
      alert("Testimony submitted successfully!");

      console.log(res);

      // Reset form
      this.testimonyData = {
        username: '',
        email: '',
        message: '',
        profession: ''
      };
    },

    error: (err) => {
      console.log(err);
      alert(err?.error?.message || "Something went wrong");
    }

  });
}

}
