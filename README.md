# MediSync — Smart OPD Queue & Centralized Patient History System

MediSync is a full-stack clinic management system for Sri Lankan government-hospital
style OPD care. It handles clinic-session scheduling, appointment booking, live FIFO
queues with real-time displays, doctor consultations with prescriptions, centralized
cross-clinic medical history, lab-report uploads, email notifications, and role-based
dashboards — in English and Sinhala.

## Tech Stack

- **Frontend:** React 18 (Vite), React Router v6, Tailwind CSS, Axios, Socket.IO client, Recharts, i18next (EN/SI), lucide-react
- **Backend:** Node.js, Express, Mongoose, Socket.IO, JWT (jsonwebtoken + bcryptjs), Nodemailer (Gmail SMTP), node-cron, PDFKit, express-validator, helmet
- **Database:** MongoDB Atlas
- **File storage:** Cloudinary (avatars + lab reports — only URLs are stored in MongoDB)

## Roles

| Role | What they can do |
|------|------------------|
| **Patient** | Book today/tomorrow clinic sessions, watch live queue position, view medical history, upload lab reports, download history/prescription PDFs |
| **Doctor** | Manage their patient queue (call next / skip / complete), write consultation records with prescriptions, toggle availability, view any patient's cross-clinic history |
| **Staff** (Receptionist / Nurse) | Register patients & doctors, walk-in booking with instant queue token, manage the live queue, upload patient reports, view clinic patients |
| **Admin** | Everything above plus: clinic & session scheduling, user management, appointment/record oversight, roles & permissions matrix (deny-only), audit logs, analytics reports with PDF export, bulk patient import from CSV |

## How the system is organised

- The demo runs with **three clinics**: General OPD, Diabetic Clinic, Heart (Cardiology) Clinic (auto-seeded on first start).
- Admin schedules **ClinicSessions** (clinic + doctor + date + time). Patients book against **today's or tomorrow's sessions only** — simple session cards, no free date/time picking.
- Every patient is **registered to one or more clinics** and can only book clinics they belong to (General OPD is open to everyone).
- Booking creates an appointment **and a queue token** in one step; queue positions update live over Socket.IO.
- All consultation records are visible to every doctor with a clinic label (**cross-clinic history**); records without a clinic display as General OPD.

For the full step-by-step flow, see [SYSTEM_PROCESS.md](SYSTEM_PROCESS.md).

## Local Setup

Requirements: Node.js 18+, a MongoDB Atlas cluster, a Gmail account with an app password, a Cloudinary account (free tier is fine).

```bash
# 1. Backend
cd medisync/backend
npm install
# fill in backend/.env (see below)
npm run dev          # http://localhost:5000

# 2. Frontend (new terminal)
cd medisync/frontend
npm install
npm run dev          # http://localhost:3000
```

### backend/.env

This is the **only** .env file in the project:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=any_long_random_string
JWT_EXPIRE=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
CLIENT_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

The frontend needs **no .env for local dev** — it falls back to `http://localhost:5000`.
When you deploy, set these two variables on the frontend hosting platform instead:

```env
VITE_API_URL=https://your-backend-url/api
VITE_SOCKET_URL=https://your-backend-url
```

### Default (seeded) logins

Created automatically on first server start:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@medisync.lk | Admin@1234 |
| Staff (Reception) | reception@medisync.lk | Staff@1234 |
| Staff (Nurse) | nurse@medisync.lk | Nurse@1234 |

The three demo clinics are also seeded automatically when the Clinic collection is empty.

## Hosting / Deployment

The app deploys as **two services** sharing one MongoDB Atlas database:

### 1. Backend → Render / Railway (any Node host)

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: copy everything from `backend/.env`, but change:
  - `NODE_ENV=production`
  - `CLIENT_URL=https://<your-frontend-domain>` (exact URL, no trailing slash — used for CORS and Socket.IO)
- In **MongoDB Atlas → Network Access**, allow access from anywhere (`0.0.0.0/0`) or the host's IPs.

### 2. Frontend → Vercel / Netlify

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
  - `VITE_API_URL=https://<your-backend-domain>/api`
  - `VITE_SOCKET_URL=https://<your-backend-domain>`

### 3. After deploying

1. Open the backend health check: `https://<backend>/api/health` → should return `{"status":"ok"}`.
2. Open the frontend URL and log in with the seeded admin account.
3. Schedule clinic sessions (Admin → Clinic Management) so patients can book.

Notes:

- Uploaded files live in **Cloudinary** (`medisync/avatars`, `medisync/reports`), so hosting has no local file storage to worry about.
- Free-tier hosts sleep after inactivity; the daily 8 AM email reminder cron only fires while the server is awake.
- `backend/scripts/setupThreeClinics.js` is a one-time migration tool for trimming an existing database down to the three demo clinics — a fresh database doesn't need it.

## API Summary

- Auth: `/api/auth/login`, `/api/auth/create-user`, `/api/auth/profile`, `/api/auth/avatar`
- Clinic sessions: `/api/clinic-sessions`, `/api/clinic-sessions/upcoming`
- Appointments: `/api/appointments`, `/api/appointments/my`
- Queue: `/api/queue/generate`, `/api/queue/live/:clinicId`, `/api/queue/next/:clinicId`, `/api/queue/my`, `/api/queue/public/:clinicId`
- Patients: `/api/patients`, `/api/patients/search`, `/api/patients/me`, `/api/patients/:id/history`, `/api/patients/:id/clinics`
- Doctors: `/api/doctors`, `/api/doctors/me`, `/api/doctors/me/availability`
- Records: `/api/records`, `/api/records/patient/:id`, `/api/records/:id/prescription-pdf`, `/api/records/patient/:id/history-pdf`
- Lab reports: `/api/medical-reports`
- Notifications: `/api/notifications/my`
- Reports: `/api/reports/daily`, `/api/reports/queue-performance`, `/api/reports/patient-stats`, `/api/reports/export/pdf`
- Admin: `/api/admin/users`, `/api/admin/clinics`, `/api/admin/audit-logs`, `/api/admin/roles`, `/api/admin/records`, `/api/admin/patients/import`, `/api/admin/dashboard-stats`

## Real-Time Events (Socket.IO)

Sockets authenticate with the same JWT as the REST API, then join `user:<id>` and `clinic:<id>` rooms.

| Event | Room | Fired when |
|-------|------|-----------|
| `queue:updated` | `clinic:<id>` | Any queue change (new token, status change, cancel) |
| `queue:token_called` | `user:<id>` | The patient's own token is called |
| `doctor:status_changed` | `clinic:<id>` | A doctor toggles availability |
| `notification` | `user:<id>` | A new in-app notification is created |

## Email Notifications (Gmail SMTP)

1. Booking confirmation (with queue token)
2. Queue token issued (walk-in)
3. "Your turn is near" alert
4. Daily 8 AM reminder for the day's appointments
5. Doctor schedule notification when admin assigns a session
