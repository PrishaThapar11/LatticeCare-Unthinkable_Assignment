# System Design — LatticeCare

## Double-booking prevention

Two layers guard against a slot being booked twice:

1. **Database constraint.** `Appointment` has `@@unique([doctorId, startsAt])`. Even if two requests race past every application-level check, only one `INSERT` can succeed — SQLite/Postgres reject the second with a unique-constraint violation (`P2002`).
2. **Transactional check-then-create.** `POST /appointments` wraps the read-then-write in a single `prisma.$transaction`: it looks up whether the exact `(doctorId, startsAt)` pair is already taken, and only creates the appointment if not, inside the same transaction boundary. This closes the classic check-then-act race that a naive "query, then insert" pattern leaves open.
3. **Graceful conflict response.** If the unique constraint still fires (extreme concurrency, or the transactional check loses a race at the DB engine level), the route catches it and returns `409 Slot just taken — choose another`, rather than a generic 500. The frontend surfaces this as a toast so the patient can immediately pick a different time instead of silently failing.

Available slots themselves are computed on read (`GET /doctors/:id/slots`) by generating every slot in the doctor's working-hours window for that weekday, then subtracting already-booked `startsAt` timestamps and skipping the day entirely if it falls on a leave day. This means the "available" list a patient sees is always derived fresh from current bookings, not a separately-maintained and potentially stale slot table — there's nothing to keep in sync.

## Doctor leave conflict handling

When a doctor (or admin) records a `LeaveDay`, `POST /doctors/:id/leave` immediately queries every `PENDING`/`CONFIRMED` appointment for that doctor on that date. For each affected appointment, in one transaction: the status flips to `RESCHEDULED` (not silently cancelled — the patient's data and history are preserved and the clinic knows a manual rebooking is owed), and a `NotificationLog` entry is queued so the patient is told automatically rather than discovering it on arrival. The doctor's Google Calendar event for that slot is also deleted, so the doctor's calendar doesn't show a commitment they can no longer keep. The endpoint returns how many bookings were affected so the UI can immediately confirm to the doctor that patients were notified, closing the loop without a separate manual step.

## Slot hold mechanism

The schema includes a `holdExpiresAt` field on `Appointment`, intended for a future soft-hold step (e.g., reserving a slot for 2 minutes while a patient fills the symptom form, without fully committing it). In the current implementation the booking flow is short enough — pick slot → fill symptom form → submit — that a hard database-transaction check at submit time is sufficient and avoids the added complexity of a background sweep to expire abandoned holds. The transactional unique-constraint approach above gives the same double-booking guarantee a hold would, without needing a cleanup job for holds that are started but never completed. If real-world usage showed patients frequently lingering on the symptom form and losing slots to faster patients, the next step would be a lightweight hold: write a `PENDING` appointment with `holdExpiresAt = now + 2min` when the slot is clicked, and have `GET /slots` also exclude held-but-unexpired slots.

## Notification failure handling

All outbound email goes through a single `queueNotification()` call that writes a `NotificationLog` row (`status: QUEUED`) rather than sending synchronously. A cron job (`node-cron`, every 5 minutes) sweeps up to 50 due `QUEUED`/`FAILED` rows and attempts delivery via Nodemailer. On success, the row is marked `SENT`. On failure — SMTP not configured, network error, provider rejection — the row is marked `FAILED`, `attempts` increments, and `nextAttemptAt` is pushed out with exponential backoff (`2^attempts` minutes), capped implicitly by the `attempts < 5` filter, after which a failed notification stops retrying and remains visible in the log for manual follow-up rather than being lost. Because sending is fully decoupled from the request/response cycle, a slow or down SMTP provider never blocks booking, cancellation, or visit completion — those endpoints only ever *queue* work, never wait on it.

## LLM failure handling

Both AI calls (`preVisit`, `postVisit` in `lib/ai.ts`) are wrapped in try/catch. On any failure — missing API key, malformed JSON response, timeout — the function returns a clearly-labeled fallback object with `retryRequired: true` instead of throwing, so the booking or visit-completion transaction that depends on it still commits. The `retryRequired` flag is stored alongside the summary, so a future retry sweep (structurally identical to the notification retry queue) could reprocess just the flagged rows without touching successful ones.
