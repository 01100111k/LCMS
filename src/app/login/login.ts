import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  template: `
    <main style="min-height:100vh;display:grid;place-items:center;font-family:system-ui;text-align:center">
      <div>
        <h1>Login page</h1>
        <p>Coming next. Midwives and patients will sign in here.</p>
        <a routerLink="/">← Back to home</a>
      </div>
    </main>
  `,
})
export class Login {}