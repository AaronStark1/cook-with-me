import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';
import { AuthService } from '../../services/auth';
import { PlatterDrift, ShakeInvalid } from '../auth/auth-motion';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PlatterDrift, ShakeInvalid],
  templateUrl: './login.html',
  styleUrls: ['../auth/auth.css', './login.css']
})
export class Login {
  loginForm: FormGroup;
  submitted = false;
  loading = false;
  errorMessage = '';
  justRegistered = false;
  /** Presentation only: flips the password input between `password` and `text`. */
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private api: Apiservice,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
    this.justRegistered = this.route.snapshot.queryParamMap.get('registered') === '1';
  }

  get f() {
    return this.loginForm.controls;
  }

  login() {
    this.submitted = true;
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.api.loginAPI(this.loginForm.value).subscribe({
      next: (res: any) => {
        // AuthService persists only { username, email, role } — never the raw response.
        this.auth.setSession(res.token, res.user);
        this.router.navigateByUrl(this.targetUrl());
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Login failed. Please try again.';
      }
    });
  }

  /** Where to go after login: the page that sent us here, or a sensible default for the role. */
  private targetUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const safe = !!returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.startsWith('/login');
    if (safe && (!returnUrl!.startsWith('/admin') || this.auth.isAdmin())) {
      return returnUrl!;
    }
    return this.auth.isAdmin() ? '/admin' : '/';
  }
}
