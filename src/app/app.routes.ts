import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { guestGuard, roleGuard } from './core/guards';
import { MidwifeLayout } from './midwife/midwife-layout';
import { MidwifeDashboard } from './midwife/midwife-dashboard';
import { PatientList } from './midwife/patient-list';
import { PatientForm } from './midwife/patient-form';
import { AppointmentForm } from './midwife/appointment-form';
import { AppointmentList } from './midwife/appointment-list';
import { PatientQueue } from './midwife/patient-queue';
import { PrenatalRecords } from './midwife/prenatal-records';
import { DeliveryRecords } from './midwife/delivery-records';
import { PostpartumRecords } from './midwife/postpartum-records';
import { PatientPortal } from './patient/patient-portal';
import { AdminDashboard } from './admin/admin-dashboard';

export const routes: Routes = [
  { path: '', component: Landing, title: 'Lying-In Care Management System' },
  // /login and /signup show the landing page with the auth modal open
  { path: 'login', component: Landing, data: { auth: 'login' }, canActivate: [guestGuard], title: 'Log in · Lying-In Care' },
  { path: 'signup', component: Landing, data: { auth: 'role-select' }, canActivate: [guestGuard], title: 'Create Account · Lying-In Care' },
  {
    path: 'admin',
    component: AdminDashboard,
    canActivate: [roleGuard('admin')],
    title: 'Admin Portal · Lying-In Care',
  },
  {
    path: 'midwife',
    component: MidwifeLayout,
    canActivate: [roleGuard('midwife')],
    children: [
      { path: '', component: MidwifeDashboard, title: 'Dashboard · Lying-In Care' },
      { path: 'register-patient', redirectTo: 'patients', pathMatch: 'full' },
      { path: 'patients', component: PatientList, title: 'Patients · Lying-In Care' },
      { path: 'patients/new', component: PatientForm, title: 'Register patient · Lying-In Care' },
      { path: 'patients/:id', component: PatientForm, title: 'Patient profile · Lying-In Care' },
      { path: 'appointments', component: AppointmentList, title: 'Appointments · Lying-In Care' },
      { path: 'appointments/new', redirectTo: () => '/midwife/appointments?new=true', pathMatch: 'full' },
      { path: 'appointments/:id', component: AppointmentForm, title: 'Appointment · Lying-In Care' },
      { path: 'availability', redirectTo: 'appointments', pathMatch: 'full' },
      { path: 'queue', component: PatientQueue, title: 'Patient Queue · Lying-In Care' },
      { path: 'prenatal', component: PrenatalRecords, title: 'Prenatal Records · Lying-In Care' },
      { path: 'delivery', component: DeliveryRecords, title: 'Delivery Records · Lying-In Care' },
      { path: 'postpartum', component: PostpartumRecords, title: 'Postpartum Records · Lying-In Care' },
    ],
  },
  { path: 'patient', component: PatientPortal, canActivate: [roleGuard('patient')], title: 'Patient Portal · Lying-In Care' },
  { path: '**', redirectTo: '' },
];
