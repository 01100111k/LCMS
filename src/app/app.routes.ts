import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { guestGuard, roleGuard } from './core/guards';
import {
  MidwifeLayout,
  MidwifeDashboard,
  PatientList,
  PatientForm,
  AppointmentForm,
  AppointmentList,
  MidwifeAvailability,
  PatientQueue,
  PrenatalRecords,
  DeliveryRecords,
  PostpartumRecords,
  PregnancyJourney,
  HealthLibrary,
  Reports,
  Statistics,
  Settings,
} from './midwife';
import { PatientPortal } from './patient';
import {
  AdminLayout,
  AdminOverview,
  AdminMidwives,
  AdminPatients,
  AdminPendingApprovals,
  AdminActivityLogs,
  AdminArchives,
  AdminAccount,
} from './admin';

export const routes: Routes = [
  { path: '', component: Landing, title: 'Lying-In Care Management System' },
  // /login and /signup show the landing page with the auth modal open
  { path: 'login', component: Landing, data: { auth: 'login' }, title: 'Log in · Lying-In Care' },
  { path: 'signup', component: Landing, data: { auth: 'role-select' }, title: 'Create Account · Lying-In Care' },
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [roleGuard('admin')],
    children: [
      { path: '', component: AdminOverview, title: 'Dashboard · Admin Portal' },
      { path: 'midwives', component: AdminMidwives, title: 'Midwives · Admin Portal' },
      { path: 'patients', component: AdminPatients, title: 'Patients · Admin Portal' },
      { path: 'pending-approvals', component: AdminPendingApprovals, title: 'Pending Approvals · Admin Portal' },
      { path: 'activity-logs', component: AdminActivityLogs, title: 'Activity Logs · Admin Portal' },
      { path: 'archives', component: AdminArchives, title: 'Archives · Admin Portal' },
      { path: 'settings', component: AdminAccount, title: 'Settings · Admin Portal' },
      { path: 'account', redirectTo: 'settings', pathMatch: 'full' },
      { path: 'users', redirectTo: 'pending-approvals', pathMatch: 'full' },
    ],
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
      { path: 'journey', component: PregnancyJourney, title: 'Pregnancy Journey · Lying-In Care' },
      { path: 'library', component: HealthLibrary, title: 'Health Library · Lying-In Care' },
      { path: 'reports', component: Reports, title: 'Reports · Lying-In Care' },
      { path: 'statistics', component: Statistics, title: 'Statistics · Lying-In Care' },
      { path: 'settings', component: Settings, title: 'Settings · Lying-In Care' },
    ],
  },
  { path: 'patient', component: PatientPortal, canActivate: [roleGuard('patient')], title: 'Patient Portal · Lying-In Care' },
  { path: '**', redirectTo: '' },
];