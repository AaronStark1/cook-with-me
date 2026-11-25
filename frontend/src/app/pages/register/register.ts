import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';
import { PlatterDrift, ShakeInvalid } from '../auth/auth-motion';

/**
 * A rough 0–4 read of a password, from what was typed only (length and
 * character classes). It feeds the decorative meter and nothing else — the
 * form's validators are the only thing that decides whether a password is accepted.
 */
export function passwordScore(value: string | null | undefined): number {
  const text = value ?? '';
  if (!text) return 0;
  if (text.length < 8) return 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(text)).length;
  return 2 + (classes >= 3 ? 1 : 0) + (text.length >= 12 ? 1 : 0);
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PlatterDrift, ShakeInvalid],
  templateUrl: './register.html',
  styleUrls: ['../auth/auth.css', './register.css']
})
export class Register {

  registerForm: FormGroup;
  submitted = false;
  loading = false;
  errorMessage = '';
  /** Presentation only: flips the password input between `password` and `text`. */
  showPassword = false;
  readonly meterSteps = [1, 2, 3, 4];

  constructor(
    private fb: FormBuilder,
    private api: Apiservice,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      // Matches the API rule: 8–72 characters
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]]
    });
  }

  get f() {
    return this.registerForm.controls;
  }

  /** Squares lit in the (decorative) strength meter. */
  get strength(): number {
    return passwordScore(this.f['password'].value);
  }

  submit() {
    this.submitted = true;
    this.errorMessage = '';

    if (this.registerForm.invalid) {
      return;
    }

    this.loading = true;
    this.api.registerUserAPI(this.registerForm.value).subscribe({
      next: () => {
        this.router.navigate(['/login'], { queryParams: { registered: 1 } });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Registration failed. Please try again.';
      }
    });
  }
}
