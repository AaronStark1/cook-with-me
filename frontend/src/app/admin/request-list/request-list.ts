import { Component, OnInit, inject } from '@angular/core';
import { Apiservice } from '../../services/apiservice';
import { MotionPrefs } from '../../motion/motion-prefs';
import { RowsIn } from '../row-motion';

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [RowsIn],
  templateUrl: './request-list.html',
  styleUrl: './request-list.css'
})
export class RequestList implements OnInit {

  testimonyList: any[] = [];
  loading = true;
  errorMessage = '';

  /** The request whose status the API has just confirmed: its new tag wipes in once. */
  protected freshId: string | null = null;
  private readonly prefs = inject(MotionPrefs);

  constructor(private api: Apiservice) { }

  ngOnInit(): void {
    this.getAllTestimonies();
  }

  getAllTestimonies() {
    this.api.getTestimonyAPI().subscribe({
      next: (res: any) => {
        this.testimonyList = res.allTestimony ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load requests. Please try again.';
      }
    });
  }

  approveTestimony(id: string) {
    this.updateStatus(id, 'Approved');
  }

  rejectTestimony(id: string) {
    this.updateStatus(id, 'Rejected');
  }

  private updateStatus(id: string, status: 'Approved' | 'Rejected') {
    this.errorMessage = '';
    this.api.updateTestimonyStatusAPI(id, status).subscribe({
      next: () => {
        this.freshId = this.prefs.reduced() ? null : id;
        this.getAllTestimonies();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Could not update the request.';
      }
    });
  }

}
