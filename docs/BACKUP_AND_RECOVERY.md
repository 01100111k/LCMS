# Firestore Backup and Disaster Recovery Procedure (LCMS)

This document establishes the official backup and disaster recovery standard operating procedure for the **Lying-In Care Management System (LCMS)** Cloud Firestore database.

---

## 1. Overview and Architecture

- **Database Engine**: Google Cloud Firestore (Native Mode)
- **Target Storage**: Secured Google Cloud Storage (GCS) Bucket
- **Security Standard**: Enterprise AES-256 encryption-at-rest, TLS 1.3 in-transit, IAM least-privilege access, Public Access Prevention (Enforced).
- **Retention Policy**:
  - Point-in-Time Recovery (PITR): 7-day continuous window.
  - Daily Scheduled Backups: 30-day retention in coldline/standard storage.

---

## 2. Automated Scheduled Backups (Recommended Production Setup)

### Option A: Firestore Native Backup Schedules (Google Cloud CLI)
Run the following command to schedule daily automated snapshots at 02:00 AM UTC:

```bash
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=30d
```

To list existing backup schedules:
```bash
gcloud firestore backups schedules list --database='(default)'
```

### Option B: Cloud Function & Cloud Scheduler Export to GCS
1. Create a dedicated private storage bucket:
   ```bash
   gcloud storage buckets create gs://lying-in-care-management-system-backups \
     --location=asia-southeast1 \
     --uniform-bucket-level-access \
     --public-access-prevention
   ```
2. Grant the Firestore service account `roles/datastore.importExportAdmin` and `roles/storage.admin` on the bucket:
   ```bash
   PROJECT_ID="lying-in-care-management-system"
   SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"
   
   gcloud storage buckets add-iam-policy-binding gs://${PROJECT_ID}-backups \
     --member="serviceAccount:${SERVICE_ACCOUNT}" \
     --role="roles/storage.admin"
   ```

---

## 3. On-Demand Manual Backup (Before Migrations / Major Maintenance)

To manually trigger a complete snapshot of all LCMS Firestore collections (`users`, `patients`, `midwives`, `appointments`, `prenatal_records`, `delivery_records`, `postpartum_records`, `visits`, `activityLogs`, `facility_settings`):

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_ID="lying-in-care-management-system"
BACKUP_BUCKET="gs://${PROJECT_ID}-backups"

gcloud firestore export ${BACKUP_BUCKET}/manual_${TIMESTAMP} \
  --project=${PROJECT_ID}
```

To export only specific collections (e.g., patient and clinical records):
```bash
gcloud firestore export ${BACKUP_BUCKET}/clinical_${TIMESTAMP} \
  --collection-ids='patients','appointments','prenatal_records','delivery_records','postpartum_records' \
  --project=${PROJECT_ID}
```

---

## 4. Disaster Recovery & Data Restoration

### Step 1: Identify the Target Backup
List available backups in the backup bucket:
```bash
gcloud storage ls gs://lying-in-care-management-system-backups/
```
Each backup directory contains the export metadata file `[TIMESTAMP].overall_export_metadata`.

### Step 2: Execute Import
To restore the entire database snapshot:
```bash
EXPORT_PATH="gs://lying-in-care-management-system-backups/manual_20261108_100000"

gcloud firestore import ${EXPORT_PATH} \
  --project=lying-in-care-management-system
```

To restore only specific collections:
```bash
gcloud firestore import ${EXPORT_PATH} \
  --collection-ids='patients','prenatal_records' \
  --project=lying-in-care-management-system
```

### Step 3: Verification
1. Sign in to the Admin Dashboard (`/admin`).
2. Verify patient counts, activity logs, and system accounts.
3. Review audit logs (`/admin/activity-logs`) to verify system integrity.

---

## 5. Security & Access Restrictions

1. **Access Restriction**: Only designated System Administrators with `roles/owner` or `roles/datastore.importExportAdmin` IAM roles have permission to execute export/import operations.
2. **No Public Access**: The backup bucket must have `uniform-bucket-level-access` and `public-access-prevention` enforced.
3. **Data Integrity**: Firestore exports preserve document UIDs, subcollections, and server timestamps without data loss.
4. **Audit Trail**: Every export and import operation is automatically recorded in Google Cloud Audit Logs.
