import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  token: any = ""
  userDetails: any = {}
  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private api: Apiservice,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  login() {

    if (this.loginForm.invalid) {
      alert('Please enter valid credentials');
      return;
    }

    this.api.loginAPI(this.loginForm.value).subscribe({

      next: (res: any) => {
        console.log(res);

        this.token = res.token;
        this.userDetails = res.user;

        // Store in sessionStorage (as you were using)
        sessionStorage.setItem('token', this.token);
        sessionStorage.setItem(
          'userDetails',
          JSON.stringify(this.userDetails)
        );

        alert('Login successful');
        if (res.user.role=="admin") {
          this.router.navigateByUrl("/admin")
        } else {
          this.router.navigateByUrl('/');
        }
        


      },

      error: (err) => {
        console.log(err);
        alert(err?.error?.message || 'Login failed');
      }

    });
  }

}
