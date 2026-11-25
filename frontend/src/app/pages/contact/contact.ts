import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Apiservice } from '../../services/apiservice';
import { AuthService } from '../../services/auth';
import { Stamp } from '../../components/stamp/stamp';

@Component({
  selector: 'app-contact',
  imports: [FormsModule, RouterLink, Stamp],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  // Author name/email come from the signed-in account on the server,
  // so only the message and profession are collected here.
  testimonyData = {
    message: '',
    profession: '',
    agree: false
  };

  submitted = false;
  loading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private api: Apiservice, protected auth: AuthService) { }

  addTestimony(form: NgForm) {
    this.submitted = true;
    this.successMessage = '';
    this.errorMessage = '';

    if (form.invalid) {
      return;
    }

    this.loading = true;
    const { message, profession } = this.testimonyData;
    this.api.addTestimonyAPI({ message: message.trim(), profession: profession.trim() }).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'Thank you! Your testimony was submitted and is awaiting approval.';
        this.submitted = false;
        form.resetForm({ message: '', profession: '', agree: false });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Something went wrong. Please try again.';
      }
    });
  }

}
