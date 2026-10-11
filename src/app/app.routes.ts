import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { Login } from './login/login';

export const routes: Routes = [
  { path: '', component: Landing, title: 'Lying-In Care Management System' },
  { path: 'login', component: Login, title: 'Login · Lying-In Care' },
  { path: '**', redirectTo: '' },
];