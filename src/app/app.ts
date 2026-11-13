import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = e.urlAfterRedirects || e.url || '';
        const isPortal = url.startsWith('/midwife') || url.startsWith('/patient') || url.startsWith('/admin');
        if (!isPortal && typeof document !== 'undefined') {
          document.body.classList.remove('dark-mode');
          document.documentElement.classList.remove('dark-mode', 'dark-theme');
          document.documentElement.removeAttribute('data-theme');
        }
      });
  }
}