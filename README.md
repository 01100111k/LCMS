# Lying-In Care Management System (LCMS)

A web-based maternal healthcare and clinic management platform engineered to digitize, streamline, and secure clinical workflows in lying-in centers and birthing clinics.

---

## Project Overview

In community healthcare and maternal birthing facilities, record-keeping has traditionally depended on physical paper logbooks, manual index cards, and unlinked registration slips. These traditional practices create operational challenges, including misplaced patient prenatal histories, appointment scheduling conflicts, delayed maternal triage, and an absence of audit trails for sensitive health data.

The **Lying-In Care Management System (LCMS)** addresses these challenges by centralizing maternal healthcare records, patient-midwife scheduling, clinical triage, and facility governance into a unified, role-governed digital ecosystem. The system supports lying-in clinics throughout the continuum of maternal care: from initial patient registration and multi-stage prenatal examinations, through labor and delivery documentation, to postpartum checkups and newborn monitoring.

---

## Key Features

Features are divided across three dedicated user portals based on clinical and administrative responsibilities:

### 1. Administrator Portal (`/admin`)
- **Facility Operations Dashboard**: Real-time overview of active patients under care, registered midwives on active duty, pending applicant verifications, and system activity counters.
- **Account Verification & Approval Workflow**: Two-phase verification workflow for newly submitted midwife and patient applications with credential validation before granting system access.
- **Midwife Registry Management**: View licensed birth attendants, track PRC (Professional Regulation Commission) license numbers, monitor active duty statuses, view assigned patient loads, deactivate accounts, or archive records.
- **Patient Directory Oversight**: Comprehensive listing of registered mothers, blood types, obstetrical parity (GP notation), gestational progress, risk classifications (Low risk, High risk), and record archive tools.
- **Immutable Activity Audit Trails**: Chronological logging of all administrative actions, patient enrollments, approval status modifications, and data updates with timestamps and actor identities.
- **Archives Repository**: Secure archiving module to view and restore inactive patient and staff profiles without permanent data deletion.
- **Facility & Account Settings**: Administrator profile management, password updates, and clinic configuration.

### 2. Licensed Midwife Portal (`/midwife`)
- **Clinical Dashboard**: Quick metrics on today's appointments, active patient queue, urgent clinical alerts, and pending prenatal reviews.
- **Patient Registry & Onboarding**: Register expectant mothers directly with demographic details, emergency contacts, obstetrical history, and automatically linked midwife attribution.
- **Intelligent Appointment Scheduler**: Date and time-slot booking calendar with automated conflict prevention against duplicate bookings and midwife schedule blocks.
- **Live Patient Queue & Triage**: Queue ticket management to track waiting, serving, and completed patients during clinic hours.
- **Maternal Health Records Suite**:
  - **Prenatal Records**: Log gestational age, vitals (BP, weight, pulse, fundal height, fetal heart tones), risk evaluations, lab results, and iron/calcium supplement allocations.
  - **Delivery & Birth Records**: Record labor onset, delivery date and time, birth outcomes, newborn vitals (weight, sex, Apgar scores), and maternal delivery notes.
  - **Postpartum Records**: Track maternal recovery, lochia assessment, vital stability, lactation initiation, and scheduled postpartum visits.
  - **Pregnancy Journey Tracker**: Timeline visualization tracking maternal milestones, trimester transitions, and clinical checklists.
- **Health Education Library**: Searchable repository of evidence-based maternal health, nutrition, danger-sign, and infant care guidance.
- **Clinical Reports & Analytics**: Statistical breakdown of monthly deliveries, prenatal visit frequencies, patient demographics, and facility case summaries.
- **Midwife Schedule & Availability Settings**: Configure operating days, consultation time slots, and account preferences.

### 3. Patient Portal (`/patient`)
- **Personal Maternal Dashboard**: View upcoming appointments, gestational progress, current trimester, and primary midwife contact information.
- **Interactive Pregnancy Tracker**: Real-time gestational age counter based on Last Menstrual Period (LMP) and Expected Due Date (EDD), with trimester milestone guidance.
- **Appointment Self-Service**: Book, view, and reschedule clinic appointments according to midwife availability without phone calls or in-person visits.
- **My Care Records**: Secure read-only access to personal prenatal checkups, delivery records, and postpartum summaries recorded by attending midwives.
- **Direct Midwife Communication**: Submit clinical inquiries, symptom questions, or consultation follow-ups directly to the assigned healthcare team.
- **Patient Profile Management**: Update personal contact numbers, residential address, and emergency contact details while clinical vitals remain protected from accidental tampering.
- **Digital Health Library**: Patient-accessible maternal guidance covering nutrition, exercise safety, danger signs requiring immediate clinic evaluation, and newborn prep.

---

## User Roles and Permissions

The system implements strict Role-Based Access Control (RBAC) enforced both on the client via Angular route guards and on the database layer via Cloud Firestore security rules.

| Role | Target Portal | Core Permissions & Capabilities |
| :--- | :--- | :--- |
| **Administrator** | `/admin` | Full facility governance. Approves new patient and midwife registrations, oversees staff registries, accesses immutable audit logs, manages archives, and configures clinic settings. Does not author clinical prenatal or delivery examination charts. |
| **Licensed Midwife** | `/midwife` | Clinical management. Registers mothers, schedules consultations, calls queue tickets, authors and edits prenatal, delivery, and postpartum charts, reviews clinical reports, and manages personal working availability. |
| **Patient** | `/patient` | Personal care engagement. Views personal gestational milestones, requests appointments, reviews personal care charts, accesses health educational material, submits inquiries, and updates non-clinical profile details. |
| **Public / Guest** | `/`, `/login`, `/signup` | Browses clinic landing information, registers as a patient or midwife (routed to pending verification status), checks verification status, and logs into existing accounts. |

---

## Technology Stack

### Frontend & Application Layer
- **Angular 22 (v22.2.0)**: Standalone component architecture, reactive signals, dynamic routing, and modular sub-portal structures.
- **TypeScript 6 (v6.0.2)**: Strict type checking, interfaces for healthcare data models, and static analysis.
- **RxJS (v7.8.0)**: Reactive programming for asynchronous stream handling and event-driven data pipelines.
- **Modern CSS3 & Theme System**: Component-scoped styling featuring complete Light Mode and Dark Mode palettes with persistent local storage preferences.

### Backend as a Service & Security
- **Firebase Authentication (v13.0.0)**: Secure session management, email/password credential handling, and token verification.
- **Cloud Firestore**: Real-time NoSQL cloud database providing structured collections, subcollections, offline persistence capabilities, and declarative security rules.
- **Dual Firebase App Architecture**: Primary authentication instance for ongoing user sessions paired with an isolated secondary app instance (`secondaryApp`) allowing administrators and midwives to provision new user accounts without losing their active login session.

### Development & Tooling
- **Angular CLI (v22.2.2)**: Build orchestration, code scaffolding, and optimization.
- **Vitest (v5.0.0)**: Unit test execution framework for component and service validation.
- **Prettier (v3.8.1)**: Source code formatting.

---

## System Architecture

LCMS utilizes a decoupled client-cloud architecture where the Angular Single-Page Application (SPA) directly interfaces with Firebase services via the official Firebase Web SDK.

```
+-------------------------------------------------------------------------------+
|                           CLIENT TIER (Angular SPA)                           |
+-------------------------------------------------------------------------------+
|  Public Tier   |   Administrator Portal   |   Midwife Portal   | Patient Portal|
|  (/login, /)   |         (/admin)         |      (/midwife)    |   (/patient)  |
+-------------------------------------------------------------------------------+
|                                 CORE SERVICES                                 |
|   - AuthService (RBAC, Session, Dual-App Instance Account Provisioning)       |
|   - RecordsService (Prenatal, Delivery, Postpartum, Clinical Timelines)       |
|   - AppointmentsService (Slots, Double-Booking Guard, Status Updates)         |
|   - PatientsService (Registry, Gestational Calculations, Medical Profiles)    |
|   - ActivityLogService (Administrative Audit Trails, Traceability)            |
|   - NotificationsService (Queue Notifications, System Alerts)                 |
+-------------------------------------------------------------------------------+
|                               CLIENT SECURITY                                 |
|       - Angular Route Guards (`roleGuard`, `guestGuard`)                      |
+---------------------------------------+---------------------------------------+
                                        | HTTPS / WebSocket
                                        v
+-------------------------------------------------------------------------------+
|                         CLOUD TIER (Firebase Backend)                         |
+-------------------------------------------------------------------------------+
|  Firebase Authentication             |  Cloud Firestore Database               |
|  - Email/Password Provider           |  - Collections: users, midwives,       |
|  - Token Issuance & Verification     |    patients, appointments, records,   |
|  - Role Claims & Session Persistence |    pendingApprovals, activityLogs, etc.|
|                                      |  - Declarative Firestore Security Rules|
+-------------------------------------------------------------------------------+
```

### Core Architecture Highlights
1. **Isolated Route Guards**: Unauthorized attempts to access `/admin`, `/midwife`, or `/patient` are intercepted prior to component instantiation, redirecting users according to their verified role.
2. **Dual Firebase Instances**: Account creation operations invoke `secondaryAuth` and `secondaryDb`. This guarantees that an administrator registering a new midwife or a midwife onboarding a patient does not get signed out of their own administrative session.
3. **Reactive Data Synchronization**: Core services subscribe to Firestore snapshots, propagating clinical queue updates, calendar changes, and patient records in real time.

---

## Project Structure

```
LCMS/
├── angular.json
├── firestore.rules               # Declarative security rules governing Firestore collections
├── package.json                  # Dependencies, build scripts, and engine specifications
├── tsconfig.json                 # TypeScript compiler configuration
├── public/                       # Static public assets (icons, images)
└── src/
    ├── index.html                # Main application HTML entry point
    ├── main.ts                   # Angular application bootstrap
    ├── styles.css                # Global stylesheet, theme tokens, and reset rules
    ├── environments/
    │   ├── environment.ts        # Environment configuration and Firebase keys
    │   └── environment.development.ts
    └── app/
        ├── app.component.ts      # Root shell component
        ├── app.routes.ts         # Top-level routing table and route guards
        ├── core/                 # Shared singleton services, models, and utilities
        │   ├── activity-log.service.ts
        │   ├── appointments.service.ts
        │   ├── auth.service.ts   # Authentication and session handling
        │   ├── firebase.ts       # Firebase app and secondaryApp initialization
        │   ├── guards.ts         # RoleGuard and GuestGuard definitions
        │   ├── health-library.data.ts
        │   ├── notifications.service.ts
        │   ├── patients.service.ts
        │   └── records.service.ts
        ├── landing/              # Public landing page, registration modals, and login
        ├── admin/                # Administrator portal module
        │   ├── components/
        │   │   ├── admin-layout.ts
        │   │   ├── admin-overview.ts
        │   │   ├── admin-midwives.ts
        │   │   ├── admin-patients.ts
        │   │   ├── admin-pending-approvals.ts
        │   │   ├── admin-activity-logs.ts
        │   │   ├── admin-archives.ts
        │   │   └── admin-account.ts
        │   ├── models/
        │   └── services/
        ├── midwife/              # Midwife portal module
        │   └── components/
        │       ├── midwife-layout.ts
        │       ├── midwife-dashboard.ts
        │       ├── patient-list.ts
        │       ├── patient-form.ts
        │       ├── appointment-list.ts
        │       ├── appointment-form.ts
        │       ├── patient-queue.ts
        │       ├── prenatal-records.ts
        │       ├── delivery-records.ts
        │       ├── postpartum-records.ts
        │       ├── pregnancy-journey.ts
        │       ├── health-library.ts
        │       ├── reports.ts
        │       ├── statistics.ts
        │       └── settings.ts
        └── patient/              # Patient portal module
            ├── patient-portal.ts
            ├── patient-portal.html
            └── patient-portal.css
```

---

## Installation and Setup

### Prerequisites
Before running the project locally, ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **Angular CLI**: `v22.x` (`npm install -g @angular/cli`)
- A modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox)

### Step-by-Step Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/LCMS.git
   cd LCMS
   ```

2. **Install project dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase Environment**
   Create or verify the environment file at `src/environments/environment.ts` (see [Firebase Configuration](#firebase-configuration) below).

4. **Launch the development server**
   ```bash
   ng serve
   ```
   Or:
   ```bash
   npm start
   ```

5. **Access the application**
   Navigate to `http://localhost:4200/` in your browser. The application will automatically reload if you change any source files.

6. **Running Unit Tests**
   ```bash
   npm test
   ```

---

## Firebase Configuration

The application requires a configured Google Firebase project with **Firebase Authentication** (Email/Password provider enabled) and **Cloud Firestore Database**.

### Safe Environment Setup

1. In the [Firebase Console](https://console.firebase.google.com/), create a new project.
2. Register a Web App in project settings to generate your client configuration object.
3. Configure your local configuration inside `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  }
};
```

> **Security Notice**: Never commit sensitive private keys, service account JSON files, or production secrets into version control. Ensure `src/environments/environment.ts` is handled responsibly according to your team's deployment standards.

### Deploying Firestore Security Rules

Deploy the included `firestore.rules` file to your Firebase project to guarantee database-level access restrictions:

```bash
firebase deploy --only firestore:rules
```

---

## Security and Data Privacy

The system handles sensitive Maternal and Child Health (MCH) information and adheres to the following security principles:

1. **Role-Based Authorization**:
   - Angular route guards prevent unauthorized navigation across portal boundaries.
   - Cloud Firestore rules evaluate user role metadata stored within the authenticated document path (`/users/{uid}`) before granting read/write operations.
2. **Self-Escalation Prevention**:
   - Firestore security rules explicitly forbid users from modifying their own `role` field or mutating their `approvalStatus`.
   - New accounts are restricted to pending verification states until approved by an administrator.
3. **Data Ownership & Clinical Privacy**:
   - Expectant mothers can only read records tied directly to their personal UID or email address.
   - Midwives can access and document clinical charts for patients under care within their facility.
   - Administrators oversee facility audit logs and user registries but cannot alter clinical examination findings.
4. **Auditability**:
   - Administrative actions (approvals, deactivations, archives, roster changes) are logged into the `activityLogs` collection to maintain accountability.

---

## System Limitations

To maintain clear operational expectations and ethical standards, the system's intended scope includes the following explicit limitations:

- **Record Management & Administrative Scope**: The system functions as a digital record-keeping, triage coordination, and administrative management solution. It **does not** provide automated medical diagnoses, clinical prescription algorithms, or emergency medical dispatch.
- **Not an Emergency System**: Expectant mothers experiencing acute obstetric emergencies (such as heavy hemorrhaging, preeclampsia symptoms, or severe abdominal trauma) are directed to contact emergency medical services or proceed immediately to the nearest tertiary hospital facility.
- **Network Dependency**: Live database sync and account authentication require active internet connectivity to communicate with Firebase cloud endpoints. Offline data synchronization is limited to standard browser caching.
- **Hardware Integration**: The system does not interface directly with external hardware diagnostic devices (such as cardiotocography monitors or ultrasound machines); diagnostic measurements must be entered manually by attending midwives.

---

## Future Enhancements

The following improvements are identified for future development iterations:

- [ ] **SMS & Telephony Reminders**: Automated SMS notifications for appointment confirmations, upcoming prenatal checkup reminders, and post-delivery follow-ups.
- [ ] **Progressive Web App (PWA) Offline Sync**: Full Service Worker caching enabling midwives in remote or low-connectivity community clinics to document offline visits that automatically sync once connected.
- [ ] **Direct Laboratory Results Attachment**: File upload support for laboratory diagnostic reports, ultrasound scans, and blood test documents stored in Cloud Storage.
- [ ] **Expanded Multi-Language Support**: Localization into regional languages (e.g., Filipino/Tagalog, Cebuano) to enhance accessibility for expectant mothers across diverse communities.
- [ ] **Automated Maternal Risk Indicator Flags**: Automated visual flags that alert midwives when recorded vitals (e.g., elevated blood pressure thresholds) exceed standard prenatal protocol guidelines.

---

## Developers and Project Information

This project was developed as an academic capstone and portfolio software engineering initiative to address real-world challenges in community maternal healthcare administration.

- **Project Lead / Developer**: [Glaiza Kaye Valcorza](mailto:kayetvalcorza@gmail.com)
- **Program / Department**: Information Technology / Computer Studies
- **Institution**: [University / Academic Institution Name]
- **Academic Year**: 2026
- **Repository**: [GitHub Repository](https://github.com/01100111k/LCMS)

---

## License

This project is developed for educational and portfolio demonstration purposes. All rights reserved. For inquiries regarding licensing, deployment, or clinical adaptation, please contact the development team.
