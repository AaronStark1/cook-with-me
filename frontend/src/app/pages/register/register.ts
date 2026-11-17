import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {

  registerForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private api: Apiservice,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  submit() {

    if (this.registerForm.invalid) {
      alert('Please fill all fields correctly');
      return;
    }

    this.api.registerUserAPI(this.registerForm.value).subscribe({
      next: (res: any) => {
        alert('Registration successful');
        this.router.navigateByUrl('/login');
      },
      error: (err) => {
        alert(err?.error?.message || 'Registration failed');
      }
    });
  }
}
