# Lobbie — product brief and plan

> **Lobbie** (לובי) — *everyone under one roof.*
> A responsive web app where the residents of a building see everything about it, and the
> building committee (ועד בית) runs it from one place.

This brief is the input to `/build`. It records what was decided in the naming and scoping
conversation (2026-10-28). `/build` turns it into the spec, the architecture ADR and the
milestone plan. Anything marked **Recommended** is still the user's decision there.

## 1. Product

**Who it is for**
- **Residents** (owners and tenants): see what's going on, what they owe and where the money
  goes; report problems; vote on the meeting time.
- **Committee members** (ועד): run the building, including fees, expenses, schedules,
  announcements, parking and the annual meeting.
- **Admin**: sets up the building, apartments, roles and cameras (often a committee member).

**The one thing:** a resident opens Lobbie and in five seconds knows whether they are paid
up, how much the building has, and what's happening this week.

**Success looks like**
- A committee can set up a building and invite every apartment in under 30 minutes.
- Residents stop asking "did I pay?", "when is the cleaner coming?" and "who parks in spot 7?"
  in the WhatsApp group.
- The annual meeting date is picked by the system, not by 40 WhatsApp messages.

**Form factor:** a responsive web app (phone first, then tablet and desktop). No PWA or native
app for now; a PWA or Expo can come later on the same backend.

**Languages:** Hebrew (RTL) first-class and English. Every screen works in both directions.

## 2. Features

### Must-haves (v1)

| Area | What residents see | What the committee/admin does |
|---|---|---|
| **Home** | This week at a glance: payment status, building balance, the next cleaning and gardening dates, the latest announcements, the meeting poll if one is open | — |
| **Residents directory** | Who lives in which apartment (floor, apartment, names); contact details only if that resident opted in | Add, edit and remove apartments and residents; owner vs tenant |
| **Payments** | Their apartment's monthly fee status (paid / due / overdue) and history | Set the monthly fee (per building or per apartment); record payments; see who is behind and send a reminder |
| **Building balance** | The current fund balance; income and expenses by category (cleaning, garden, elevator, electricity, repairs) with receipts | Record expenses with a category, an amount, a date and a receipt upload |
| **Schedules** | Cleaning days and times, gardening, garbage and recycling days, as a weekly view | Create recurring schedules and one-off changes ("no cleaning on Sukkot") |
| **Announcements** | A feed of committee posts; important posts pinned | Write, pin and archive posts |
| **Committee** | Who's on the committee, their roles and how to reach them | Assign committee members and roles |
| **Parking** | A list or simple map of spots: who owns which, and guest spots | Assign spots to apartments, mark guest spots |
| **Cameras** | Live views of shared-area cameras (entrance, parking, lobby), only if the building has them | Add a camera (name, location, embed or stream URL) and choose which roles can see it; the page is hidden when there are none |
| **Annual meeting** | Mark each proposed slot ✅ works / 🤷 if needed / ❌ no, once per apartment; see the ranking | Open a poll with candidate slots, close it, confirm the winning slot (with an "Add to calendar" link), and later post the minutes |
| **Admin panel** | — | One place for all of the above, plus building details and invites |

### Later (v2+)

- Issue reports with a photo and a status (open → in progress → fixed)
- Polls and votes beyond the meeting (for example "renovate the lobby?")
- A documents library (bylaws, insurance, contracts, minutes)
- Online payment (Bit, PayBox or a card provider)
- Push or email notifications beyond in-app; a PWA install
- Several buildings per committee member or management company
- A resident chat or forum

## 3. Key rules and logic

**Roles and access**
- One user can belong to one or more apartments, each in one building (v1: one building per user is fine).
- `resident` < `committee` < `admin`. Residents see their own apartment's payments in detail,
  and building totals only; the committee sees every apartment's status.
- Everything is scoped to the building; no resident ever sees another building's data.

**Joining**
- The admin creates the building and its apartments, then shares an invite link or code per
  apartment. A resident signs in (magic link or phone OTP, **Recommended:** email magic link
  for v1) and is attached to that apartment.

**Payments and balance**
- Money is stored in agorot as integers, never floats. Currency is ILS.
- An apartment's status for a month is `paid`, `due` (current month, unpaid) or `overdue`.
- The balance is computed from the ledger (opening balance + payments − expenses), never
  stored as an editable number. Every change is a ledger entry, so the history is auditable.

**Meeting scheduler**
- One response per apartment per slot: `yes` = 2 points, `maybe` = 1, `no` = 0.
- Ranking: most `yes`, then the highest score, then the fewest `no`, then the earliest date.
- Quorum: each slot shows whether `yes` (and `yes + maybe`) reach the building's quorum,
  by default 50% of apartments, configurable by the admin.
- The committee confirms the slot; the system does not auto-confirm. Residents get an
  announcement and an `.ics` "Add to calendar" link.

**Cameras**
- Lobbie does not process video. It shows what the building's DVR, NVR or cloud camera
  service already exposes: an embed URL, an HLS stream or a snapshot URL.
- The URLs are secrets: stored server-side and only rendered for allowed roles.
- Shared areas only; the admin form says so.

**Privacy**
- Phone and email in the directory are hidden unless the resident opts in.
- Receipts and camera URLs are never public.

## 4. Data model (first draft)

```
Building      id, name, address, quorumPercent, monthlyFeeDefault, openingBalance
Apartment     id, buildingId, number, floor, monthlyFee?, parkingSpotIds
User          id, name, email, phone, locale
Membership    userId, apartmentId, role(resident|committee|admin), isOwner, showContact, committeeTitle?
Invite        id, apartmentId, code, expiresAt, usedAt
Payment       id, apartmentId, month(YYYY-MM), amountAgorot, paidAt, method, recordedBy
Expense       id, buildingId, category, amountAgorot, date, description, receiptUrl, recordedBy
Schedule      id, buildingId, kind(cleaning|garden|garbage|recycling|other), rrule, time, notes
ScheduleException id, scheduleId, date, cancelled, note
Announcement  id, buildingId, title, body, pinned, createdBy, createdAt
ParkingSpot   id, buildingId, label, apartmentId?, isGuest
Camera        id, buildingId, name, location, streamUrl(secret), kind(embed|hls|snapshot), visibleToRoles
MeetingPoll   id, buildingId, title, status(open|closed|confirmed), confirmedSlotId?, minutesUrl?
MeetingSlot   id, pollId, startsAt, durationMin, location
MeetingVote   slotId, apartmentId, answer(yes|maybe|no), userId, updatedAt
```

## 5. Screens

**Resident:** Home · Payments · Balance · Schedules · Announcements · Directory · Committee ·
Parking · Cameras (if any) · Meeting · Profile and settings (language, contact visibility)

**Admin panel:** Building · Apartments and invites · Residents and roles · Fees and payments ·
Expenses · Schedules · Announcements · Parking · Cameras · Meeting polls

**Navigation:** a bottom tab bar on phones (Home, Money, Schedule, Building, More) and a side
nav on desktop. The admin panel is a separate section, shown only to committee and admin.

## 6. Recommended stack (decided in `/build`)

**Recommended:** the kit's Next.js starter, following the Next.js Learn conventions.
- Next.js (App Router), TypeScript, Server Components for reads, Server Actions for writes,
  Zod validation, view state in the URL.
- **Postgres on Neon** with a typed query layer. The data is relational (buildings →
  apartments → payments, votes per apartment and slot), and money needs transactions.
- Tailwind with logical properties (`ms-`, `pe-`, `start-`) so RTL and LTR come from the
  same classes; `next-intl` (or similar) for he/en.
- Radix primitives for dialogs, menus and tabs.
- Auth with magic-link email (Auth.js or a hosted provider).
- File uploads (receipts) to object storage (Vercel Blob or S3-compatible).
- Hosted on Vercel; domain **lobbie.co.il** (register at an ISOC-IL accredited registrar,
  for example LiveDNS).

**Alternative:** Vite + React SPA with a Node/Express API and the same Postgres. More moving
parts and no benefit for this app.

## 7. Milestones (rough, re-estimated in `/build`)

| # | Milestone | What you can do at the end |
|---|---|---|
| **M1** | Foundation | Scaffold, he/en with RTL, the layout (bottom tabs and side nav), the design direction, the database and migrations, seed data for a demo building, deploy previews |
| **M2** | Auth and the building | Sign in by magic link; the admin creates a building, apartments and invites; residents join; the directory with contact opt-in; roles and the committee page |
| **M3** | Money | Fees, recording payments, a resident's payment status and history, expenses with receipts, the ledger and balance, overdue reminders (in-app) |
| **M4** | Life in the building | Recurring schedules with exceptions, announcements with pinning, the Home "this week" dashboard |
| **M5** | Parking and cameras | Parking spots and assignments; the cameras page with role-based visibility |
| **M6** | Annual meeting | Polls, slots, voting per apartment, ranking and quorum, confirming, `.ics`, minutes |
| **M7** | Launch | Admin panel polish, empty/loading/error states everywhere, accessibility pass, metadata, 404/error pages, monitoring, README, production on lobbie.co.il |

Each milestone is a branch and a PR with a code review, a UI review, a metrics report and a demo GIF.

## 8. Open questions for `/build`

1. **Sign-in:** email magic link (Recommended), phone OTP (more natural in Israel, but SMS
   costs money), or Google sign-in?
2. **Who records payments:** the committee by hand only (Recommended for v1), or a bank or
   Excel import too?
3. **Fees:** one fee for every apartment, or a fee per apartment (by size), or both
   (Recommended: a default with a per-apartment override)?
4. **Cameras:** which camera systems do the buildings you know use? This decides whether v1
   supports embed URLs only or HLS too.
5. **Design direction:** warm and friendly, or clean and official? Any colors or references?
6. **Repo:** `jovstern/lobbie`, public or private?
7. **Data:** a demo building with seed data for the portfolio, or a real building from day one?
