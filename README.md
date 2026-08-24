# LatticeCare — Healthcare Appointment & Follow-up Manager

Care, clearly connected. A clinic platform with separate patient, doctor, and admin portals: patients book appointments and describe symptoms in advance, doctors get an AI-generated pre-visit brief and dictate post-visit notes that become a patient-friendly summary, and both sides stay in sync through email and Google Calendar.

## Stack

- **Backend** — Node.js, Express, TypeScript, Prisma ORM, SQLite (zero-setup; swap the `DATABASE_URL` provider for Postgres in production)
- **Frontend** — React, TypeScript, Vite, Tailwind CSS, React Router
- **Auth** — JWT, role-based (`PATIENT` / `DOCTOR` / `ADMIN`)
- **LLM** — Google Gemini (`gemini-2.5-flash`, free tier via Google AI Studio) for pre-visit & post-visit summaries
- **Email** — Nodemailer (SMTP), with a DB-backed retry queue swept every 5 minutes
- **Calendar** — Google Calendar API, OAuth 2.0

---

## Setup

### Prerequisites
Node.js 18+, npm.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # already pre-filled with SQLite defaults — see "Environment variables" below
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

The API runs on `http://localhost:4000`. The seed script creates:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@latticecare.demo` | `DemoPass123!` |
| Patient | `ananya.shah@demo.test` | `DemoPass123!` |
| Doctor | `meera.iyer@demo.test` (Internal Medicine) | `DemoPass123!` |
| Doctor | `naina.kapoor@demo.test` (Dermatology) | `DemoPass123!` |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` and talks to the API at `http://localhost:4000/api` by default. Override with `VITE_API_URL` in a `frontend/.env` file if needed.

### Environment variables (`backend/.env`)

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-with-a-long-random-string"
PORT=4000
FRONTEND_URL=http://localhost:5173

GEMINI_API_KEY=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="LatticeCare <no-reply@example.com>"
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/api/calendar/callback
```

The app degrades gracefully without the optional integrations:
- No `GEMINI_API_KEY` → pre/post-visit summaries fall back to a generic placeholder and are flagged `retryRequired: true`, but booking and visit completion still succeed.
- No `SMTP_*` → notifications are logged to the database (visible via `notificationLog`) but not actually emailed.
- No `GOOGLE_CLIENT_ID`/`SECRET` → calendar sync is silently skipped; nothing breaks.

**Getting a Gemini API key (free, no card required):** go to aistudio.google.com/apikey → sign in with a Google account → "Create API key". The free tier's rate limits are generous enough for demoing and evaluating this project.

**Getting Gmail SMTP credentials:** enable 2-factor auth on the Gmail account, then generate an "App Password" at myaccount.google.com/apppasswords. Use that as `SMTP_PASS` (not your normal password).

**Setting up Google Calendar OAuth:**
1. Go to console.cloud.google.com → create a project (or use an existing one).
2. Enable the "Google Calendar API" under APIs & Services → Library.
3. Configure the OAuth consent screen (External, testing mode is fine for a demo).
4. Under Credentials → Create Credentials → OAuth Client ID → Web application.
5. Add `http://localhost:4000/api/calendar/callback` as an authorized redirect URI.
6. Copy the Client ID and Client Secret into `.env`.
7. In the app, sign in as a doctor → "Connect Google Calendar" → complete the Google consent flow. The doctor's refresh token is stored and used for all future event creation/deletion for that doctor.

---

## API reference

All routes are prefixed `/api`. Authenticated routes expect `Authorization: Bearer <token>`.

### Auth
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/auth/register` | — | `{ email, password, firstName, lastName }` → patient account |
| POST | `/auth/login` | — | `{ email, password }` |

### Doctors
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/doctors?specialization=` | — | List/search doctors |
| GET | `/doctors/:id/slots?date=YYYY-MM-DD` | — | Available slots for a date, excluding booked slots and leave days |
| POST | `/doctors/:id/leave` | Doctor (own profile) / Admin | `{ date, reason? }` — marks a leave day; any existing bookings that day are auto-marked `RESCHEDULED`, their calendar events removed, and the patient notified |

### Appointments
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/appointments/mine` | Any role | Patients see their bookings, doctors see theirs, admins see all via `/admin/appointments` |
| POST | `/appointments` | Patient | `{ doctorId, startsAt, symptoms, duration?, medications? }` — books inside a DB transaction to prevent double-booking, triggers the pre-visit AI summary, queues confirmation emails, creates a calendar event |
| PATCH | `/appointments/:id/cancel` | Owning patient / doctor / admin | Cancels, deletes calendar event, queues cancellation emails |
| POST | `/appointments/:id/visit` | Owning doctor | `{ clinicalNotes, medications: [{medication, dosage, frequency}] }` — generates the post-visit AI summary and prescription, sets status to `COMPLETED` |

### Calendar
| Method | Path | Auth |
|---|---|---|
| GET | `/calendar/connect` | Doctor | Returns the Google OAuth consent URL |
| GET | `/calendar/callback` | Doctor | OAuth redirect target; stores the refresh token |

### Admin
| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/admin/doctors` | Admin | Full roster with availability |
| POST | `/admin/doctors` | Admin | `{ email, firstName, lastName, specialization, bio?, slotMinutes, availability: [{weekday, startTime, endTime}] }` — creates the user + doctor profile, returns a generated temporary password |
| GET | `/admin/appointments` | Admin | All bookings across all doctors |

---

## Database schema

Prisma models (`backend/prisma/schema.prisma`):

- **User** — role-based account (`PATIENT`/`DOCTOR`/`ADMIN`)
- **Doctor** — 1:1 with User; specialization, slot length, Google refresh token
- **DoctorAvailability** — recurring weekly working hours (`weekday`, `startTime`, `endTime`)
- **LeaveDay** — one-off unavailable dates
- **Appointment** — doctor + patient + time window + status (`PENDING`/`CONFIRMED`/`COMPLETED`/`CANCELLED`/`RESCHEDULED`), unique on `(doctorId, startsAt)` to enforce no double-booking at the DB level
- **SymptomForm** — patient's pre-visit input, 1:1 with Appointment
- **PreVisitSummary** — AI output: urgency, chief complaint, suggested questions
- **PostVisitSummary** — AI output: patient-friendly summary, follow-up steps
- **Prescription** → **MedicationReminder[]** — structured medication schedule
- **NotificationLog** — every email attempt, with status/attempts/backoff for retry

---

## LLM prompts

**Pre-visit** (`backend/src/lib/ai.ts`):
> Analyse these symptoms and return JSON only: `{"urgency":"Low|Medium|High","chiefComplaint":"string","suggestedQuestions":["string","string","string"]}`. Symptoms: `<symptoms>`

**Post-visit**:
> Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps. Return JSON only: `{"summary":"string","followUpSteps":"string"}`. Notes: `<notes>`

Both calls are wrapped in try/catch; on any failure (missing key, malformed JSON, timeout) the system falls back to a safe placeholder and flags `retryRequired: true` rather than failing the booking or visit-completion flow.

---

## Running the full flow locally

1. Start the backend (`npm run dev` in `/backend`) and frontend (`npm run dev` in `/frontend`).
2. Visit `http://localhost:5173`, browse doctors, and click a time slot — you'll be asked to sign in.
3. Log in as the seeded patient (or register a new one), pick a slot, fill the symptom form, and confirm.
4. Log in as the matching doctor in another browser/incognito window to see the booking with its AI pre-visit summary, and to submit post-visit notes.
5. Log in as the admin to add more doctors or view all bookings clinic-wide.

See `SYSTEM_DESIGN.md` for the reasoning behind slot-conflict prevention, leave handling, and notification reliability.
