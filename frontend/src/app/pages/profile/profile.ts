import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';
import { AuthService } from '../../services/auth';
import { ImgFallback, PLATE_SRC } from '../../directives/img-fallback';
import { Stamp } from '../../components/stamp/stamp';
import { Reveal } from '../../motion/reveal';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ImgFallback, Stamp, Reveal],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {

  readonly plate = PLATE_SRC;
  profileForm: FormGroup;
  downloadedRecipes: any[] = [];
  downloadsLoading = true;
  submitted = false;
  saving = false;
  message: { type: 'success' | 'danger'; text: string } | null = null;
  downloadError = '';

  constructor(
    private fb: FormBuilder,
    private api: Apiservice,
    private auth: AuthService
  ) {
    const user = this.auth.user();
    this.profileForm = this.fb.group({
      username: [user?.username ?? '', [Validators.required, Validators.maxLength(50)]],
      email: [user?.email ?? '', [Validators.required, Validators.email]]
    });
  }

  get f() {
    return this.profileForm.controls;
  }

  /** Name shown in the heading / avatar — the saved account name, not what is being typed. */
  get displayName(): string {
    return this.auth.user()?.username ?? '';
  }

  get initial(): string {
    const name = this.displayName.trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  ngOnInit(): void {
    this.getDownloadedRecipes();
  }

  updateProfile() {
    this.submitted = true;
    this.message = null;
    if (this.profileForm.invalid) return;

    this.saving = true;
    this.api.updateProfileAPI(this.profileForm.value).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.auth.updateUser(res.user);
        this.profileForm.markAsPristine();
        this.message = { type: 'success', text: 'Profile updated.' };
      },
      error: (err) => {
        this.saving = false;
        this.message = { type: 'danger', text: err?.error?.message || 'Could not update your profile.' };
      }
    });
  }

  cancel() {
    const user = this.auth.user();
    this.profileForm.reset({ username: user?.username ?? '', email: user?.email ?? '' });
    this.submitted = false;
    this.message = null;
  }

  getDownloadedRecipes() {
    this.api.getDownloadAPI().subscribe({
      next: (res: any) => {
        this.downloadedRecipes = res;
        this.downloadsLoading = false;
      },
      error: () => {
        this.downloadsLoading = false;
        this.downloadError = 'Could not load your downloads.';
      }
    });
  }

  deleteDownloadedRecipe(id: string) {
    this.downloadError = '';
    this.api.deleteDownloadAPI(id).subscribe({
      next: () => this.getDownloadedRecipes(),
      error: (err) => {
        this.downloadError = err?.error?.message || 'Could not delete the download.';
      }
    });
  }

}
