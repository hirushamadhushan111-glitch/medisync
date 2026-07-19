# MediSync — Full System Process (A → Z)

This document explains **how the whole system works, step by step** — from the moment the
server starts, through scheduling clinics, booking an appointment, moving through the queue,
the doctor consultation, and the notifications that fire along the way. It is written so
that **someone brand new to the project** can read it top to bottom and understand the
complete flow. File paths and function names are included so you can jump straight to the code.

---

## 1. The Big Picture

MediSync is a **clinic / OPD (Out-Patient Department) management system**.

- **Frontend:** React (Vite) + Tailwind CSS + React Router + Socket.IO client + i18n (English / Sinhala)
- **Backend:** Node.js + Express + MongoDB (Mongoose) + Socket.IO + JWT auth
- **Real-time:** Socket.IO pushes live queue + notification updates (no page refresh)
- **Email:** Nodemailer (Gmail SMTP) sends confirmations and reminders
- **Files:** Cloudinary stores avatars and lab reports; MongoDB stores only the URLs

There are **4 roles**, each with its own dashboard and permissions:

| Role | What they do |
|------|--------------|
| **Admin** | Schedules clinic sessions, manages clinics/users/records/roles, reports, audit logs |
| **Staff** (reception / nurse) | Registers patients & doctors, walk-in booking + tokens, manages the live queue |
| **Doctor** | Calls the queue, records consultations, writes prescriptions, sets availability |
| **Patient** | Books today/tomorrow sessions, watches their queue position, views medical history |

The demo runs with **three clinics** — General OPD, Diabetic Clinic, Heart (Cardiology)
Clinic. Every patient is **registered to one or more clinics**
(`Patient.registeredClinics`) and can only book clinics they belong to. General OPD is
open to everyone.

---

## 2. The Data Models (entities)

Everything is built from these MongoDB collections (in `backend/models/`):

| Model | Purpose | Key links |
|-------|---------|-----------|
| **User** | Login identity for **every** role (name, email, password, role, phone, NIC) | — |
| **Patient** | Patient profile (DOB, gender, blood group, weight/height, emergency contact, **registeredClinics**) | `userId → User` |
| **Doctor** | Doctor profile (department, specialization, weekly schedule, availability) | `userId → User` |
| **Clinic** | One clinic (name, departmentType, opening hours, assigned doctors) | `assignedDoctors → Doctor[]` |
| **ClinicSession** | **One clinic day**: clinic + doctor + date + start/end time — what patients actually book | `clinicId, doctorId` |
| **Appointment** | A booked visit (date, time, online/walk-in, status, queueNumber) | `patientId, doctorId, clinicId` |
| **Queue** | A **token** in the live waiting line for one day (number, position, status) | `patientId, doctorId, clinicId, appointmentId?` |
| **MedicalRecord** | A consultation result (symptoms, diagnosis, prescription, follow-up) — **tagged with the clinic** | `patientId, doctorId, clinicId?` |
| **MedicalReport** | An uploaded lab report file's metadata (the file itself is in Cloudinary) | `patientId, uploadedBy` |
| **Notification** | An in-app message for a user | `userId → User` |
| **RolePermission** | The ticked permissions for one role (deny-only overlay) | — |
| **AuditLog** | One recorded admin action (who, what, before/after) | `performedBy → User` |

> **Important idea:** a `User` is just the *login*. Medical details live in `Patient`,
> professional details in `Doctor`, joined by `userId` — so creating a patient/doctor
> always creates **two** documents.

---

## 3. Server Start-Up (`backend/server.js`)

1. `require('dotenv').config()` loads `backend/.env` (the **only** .env in the project).
2. Express app + HTTP server + **Socket.IO** are created on the same port (default 5000).
3. Global middleware: `helmet` (secure headers), `cors` (origin = `CLIENT_URL`),
   JSON parsing, `morgan` logging in dev.
4. All `/api/*` route groups are mounted.
5. `config/db.js` connects to MongoDB Atlas (retry + IPv4 + compression options tuned
   for an unstable ISP).
6. `config/seed.js` seeds whatever is missing:
   - default logins — `admin@medisync.lk` / `reception@medisync.lk` / `nurse@medisync.lk`
   - the three demo clinics (only when the Clinic collection is empty)
7. Two cron jobs start:
   - `jobs/appointmentReminder.js` — **daily 8 AM** email reminder for that day's appointments
   - `jobs/opdScheduler.js` — auto-creates the daily **General OPD session**
8. `server.listen(PORT)` — the API is live (`GET /api/health` answers `{status:'ok'}`).

---

## 4. Login & Auth (`controllers/authController.js`)

1. User submits email + password (`pages/auth/Login.jsx`).
2. `POST /api/auth/login` → bcrypt password check → a **JWT** is signed
   (`JWT_SECRET`, 7-day expiry).
3. The frontend stores token + user **per browser tab** in `sessionStorage`
   (`utils/authStorage.js`) — admin/doctor/staff/patient can be open in different tabs
   without overwriting each other.
4. Every API call sends `Authorization: Bearer <token>` (added automatically by
   `api/axiosInstance.js`). `middleware/authMiddleware.js` then:
   - `verifyToken` → loads the user, rejects inactive accounts
   - `authorizeRoles('admin', …)` → role gate per route
   - applies the **deny-only permissions overlay** (`config/permissions.js`) — admin
     can untick permissions per role in the Roles & Permissions matrix (UC20), but a
     role can never gain more than its defaults.
5. `context/AuthContext.jsx` keeps the user in React state; `App.jsx` routes each role
   to its own pages with `<ProtectedRoute allowedRoles={…}>`.

Registration is **staff/admin-side only**: `pages/staff/RegisterPatient.jsx` and
`RegisterDoctor.jsx` (doctor names are stored with a "Dr. " prefix via `withDrPrefix()`
— `frontend/src/utils/names.js` / `backend/utils/drName.js`). Every account field passes
the shared QA rules in `validators.js` (same rules front + back): valid email shape,
password ≥ 6, phone = exactly 10 digits, Sri Lankan NIC (12-digit or 9-digit + V).

---

## 5. Clinic Sessions — how clinics get a schedule

A **ClinicSession** = one clinic held on one day with one doctor. Patients never pick a
raw doctor/date/time — they book a session.

1. Admin opens **Clinic Management** (`pages/admin/ClinicManagement.jsx`).
2. Add a session: day (next 7 days), clinic, doctor (filtered to the clinic's
   department), start/end time.
3. `POST /api/clinic-sessions` (`controllers/clinicSessionController.js`):
   - validates times and checks the **doctor isn't double-booked** (overlap check)
   - adds the doctor to the clinic's `assignedDoctors`
   - notifies the doctor (in-app + styled email: "You are scheduled for …")
4. The 7-day grid shows every session; each can be edited inline or deleted.
5. `jobs/opdScheduler.js` creates the General OPD session automatically every day.

---

## 6. Booking an Appointment

### 6a. Patient books online (`pages/patient/BookAppointment.jsx`)

1. `GET /api/clinic-sessions/upcoming` returns **today's and tomorrow's** active
   sessions — shown as simple cards (clinic, doctor, time). Sinhala-first, no
   calendars or time pickers.
2. The cards are filtered to the patient's **registered clinics** (+ General OPD).
3. Patient taps a card → `POST /api/appointments` with just `{ sessionId }`.
4. `controllers/appointmentController.js → bookAppointment`:
   - the session must be today/tomorrow and (if today) not already ended
   - doctor, clinic, date and time are **derived from the session**
   - duplicate check — one booking per clinic per day per patient
   - clinic-registration check (non-OPD clinics only)
   - queue token number = last token for that clinic + day, + 1
   - all lookups run in **one parallel round-trip** (`Promise.all`) to keep booking
     fast on Atlas
5. The Appointment **and** the Queue token are created together. Estimated wait =
   people ahead × `AVG_CONSULTATION_TIME` (3 min — `utils/constants.js`).
6. Fire-and-forget after the response (the patient never waits on these):
   - **booking confirmation email** with the token number (`utils/emailTemplates.js`)
   - in-app notification (`services/notificationService.js`)
   - `queue:updated` socket event to the clinic room

### 6b. Staff walk-in booking (`pages/staff/WalkInBooking.jsx`)

1. Step 1 — find the patient (NIC / name / phone).
2. Step 2 — pick one of **today's** clinic sessions.
3. Same endpoint with `bookingType: 'walk-in'` + a `patientId`.
4. The success screen shows the big token number, patients ahead and estimated wait;
   a **queue token email** goes to the patient.

---

## 7. The Live Queue

### The data (`models/Queue.js`)

One document per token per clinic per day: `queueNumber` (printed token — never
changes), `position` (place in line — recalculated), `status`
(`waiting → serving → completed`, or `skipped`), `calledAt`, `estimatedWaitTime`.

### Doctor calls the next patient

1. Doctor Dashboard → **Call Next** → `PUT /api/queue/next/:clinicId`
   (`controllers/queueController.js`).
2. The current `serving` token is completed, the first `waiting` token becomes
   `serving`, and every remaining position is recalculated.
3. Socket events fire:
   - `queue:updated` → `clinic:<id>` room → every queue screen refreshes instantly
   - `queue:token_called` → the called patient's `user:<id>` room
4. When the patient **2 positions away** hasn't been warned yet, a **"your turn is
   near" email + notification** goes out (`nearTurnNotifiedAt` prevents duplicates).

### Everyone watches live

- **Patient** — `pages/patient/QueueStatus.jsx`: big token number, now serving,
  position, people ahead; a token switcher appears if they're queued at several clinics.
- **Staff** — `pages/staff/QueueManagement.jsx`: full live queue + status summary.
- **Waiting-room TV** — `pages/queue/PublicQueueDisplay.jsx` at `/display` —
  **no login needed** (public endpoints: `GET /api/queue/public/:clinicId`).
- **Cancelling** an appointment also cancels the token and **recalculates everyone
  behind** — positions shift up live.
- A doctor toggling availability fires `doctor:status_changed`; queue pages show a
  "queue paused" banner.

Socket plumbing: `socket/socketHandler.js` authenticates each socket with the same JWT,
then joins it to `user:<id>` and `clinic:<id>` rooms. Frontend side:
`context/SocketContext.jsx`.

---

## 8. The Consultation (`pages/doctor/ConsultationRecord.jsx`)

1. The doctor clicks a queue row (or **Start Consultation**) — the patient is
   pre-selected.
2. The page shows the patient's vitals (age, gender, blood group, BMI…), **past visits
   from every clinic** (each labelled with its clinic chip), and uploaded lab reports.
3. The doctor fills symptoms, diagnosis, notes, follow-up, and prescription rows
   (medicine / dosage / duration, with type-ahead suggestion lists).
4. `POST /api/records` (`controllers/doctorController.js → addMedicalRecord`) creates a
   `MedicalRecord` **tagged with the clinicId** where the consultation happened — this
   is what makes **cross-clinic history** work. All doctors can read all records;
   legacy records without a clinicId display as "General OPD".
5. After saving: **Download prescription PDF** (PDFKit, styled like a clinic slip), or
   **Done & Call Next** — completes the current token and calls the next patient in
   one click.
6. If the patient developed a new condition, the doctor can register them to another
   clinic on the spot (`POST /api/patients/:id/clinics`).

**History PDFs:** a patient's full history PDF
(`GET /api/records/patient/:id/history-pdf`) lists their registered clinics and each
visit's clinic.

**Lab reports:** patients (Medical History page) and staff (Patient Reports page)
upload PDF/image reports → **Cloudinary** `medisync/reports` (10 MB max); metadata in
`models/MedicalReport.js`. Avatars go to `medisync/avatars` (2 MB, auto-cropped
400×400).

---

## 9. Admin Oversight

- **User Management** — create accounts (role-specific fields appear), change roles,
  activate/deactivate, assign staff to clinics. Self-lock guards stop an admin from
  breaking their own account.
- **Appointment Management** (UC18) — all appointments, inline status change, cancel.
- **Medical Records** (UC19) — search/edit/delete any record (medical fields only).
- **Roles & Permissions** (UC20) — deny-only permission matrix per role, enforced live
  by `config/permissions.js` middleware (cache invalidated on save).
- **Audit Log** — every admin write is recorded by `utils/auditLogger.js`
  (who, what, before/after) and is searchable and filterable.
- **Reports** — daily summary, per-clinic queue performance, peak hours, visit trends,
  most-visited patients (`services/ReportService.js` MongoDB aggregations) +
  **PDF export**.
- **Bulk Import** — a CSV upload creates up to 500 patient accounts in one go
  (duplicates skipped, per-row errors reported back).

---

## 10. Notifications & Email Summary

| Trigger | In-app | Email |
|---------|--------|-------|
| Booking confirmed | ✓ | ✓ (token number) |
| Walk-in token issued | ✓ | ✓ |
| Your turn is near (2 away) | ✓ | ✓ |
| Daily 8 AM appointment reminder | — | ✓ |
| Doctor scheduled to a session | ✓ | ✓ |

All emails are **fire-and-forget** (`utils/sendEmail.js` + `utils/emailTemplates.js`) —
a slow SMTP server never slows an API response. The notification bell
(`components/NotificationBell.jsx`) shows the unread count and pops a toast when a
notification arrives live over the socket.

---

## 11. Architecture Patterns (quick reference)

- **Routes → Controllers → Services → Models** layering; controllers stay thin, and
  `services/BaseService.js` provides shared CRUD through inheritance.
- `utils/asyncHandler.js` wraps every controller — one central error handler
  (`middleware/errorMiddleware.js`) + typed errors (`utils/AppError.js`).
- `express-validator` chains + `middleware/validateRequest.js` check every input
  before it reaches a controller.
- Shared front/back validation rules (`validators.js`), shared Dr-prefix helper
  (`names.js` / `drName.js`), key-based i18n for departments & specializations
  (`utils/departments.js`).
- The frontend API layer mirrors the backend: `api/BaseApiService.js` + one service
  class per resource, all exported from `api/index.js`.
- UI conventions: Toast component for every message banner, a fixed chip colour
  palette with a global dark-mode layer in `index.css`, and `withDrPrefix()` at every
  place a doctor's name is displayed.
