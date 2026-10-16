import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { guestGuard, roleGuard } from './core/guards';
import { MidwifeLayout } from './midwife/midwife-layout';
import { MidwifeDashboard } from './midwife/midwife-dashboard';
import { PatientList } from './midwife/patient-list';
import { PatientForm } from './midwife/patient-form';
import { AppointmentForm } from './midwife/appointment-form';
import { AppointmentList } from './midwife/appointment-list';
import { PatientPortal } from './patient/patient-portal';

export const routes: Routes = [
  { path: '', component: Landing, title: 'Lying-In Care Management System' },
  // /login shows the landing page with the log in window already open
  { path: 'login', component: Landing, data: { auth: 'login' }, canActivate: [guestGuard], title: 'Log in · Lying-In Care' },
  {
    path: 'midwife',
    component: MidwifeLayout,
    canActivate: [roleGuard('midwife')],
    children: [
      { path: '', component: MidwifeDashboard, title: 'Dashboard · Lying-In Care' },
      { path: 'register-patient', component: PatientForm, title: 'Register patient · Lying-In Care' },
      { path: 'patients', component: PatientList, title: 'Patients · Lying-In Care' },
      { path: 'patients/new', component: PatientForm, title: 'Register patient · Lying-In Care' },
      { path: 'patients/:id', component: PatientForm, title: 'Patient profile · Lying-In Care' },
      { path: 'appointments', component: AppointmentList, title: 'Appointments · Lying-In Care' },
      { path: 'appointments/new', component: AppointmentForm, title: 'Schedule appointment · Lying-In Care' },
      { path: 'appointments/:id', component: AppointmentForm, title: 'Appointment · Lying-In Care' },
    ],
  },
  { path: 'patient', component: PatientPortal, canActivate: [roleGuard('patient')], title: 'My profile · Lying-In Care' },
  { path: '**', redirectTo: '' },
];