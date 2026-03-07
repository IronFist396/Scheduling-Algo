# ISMP Interview Scheduling Logic (Two-Panel Algorithm)

## Overview

The scheduler assigns interview slots to candidates from the ISMP Mentors application pool. It uses a **two-panel, greedy algorithm** that maximises throughput by allowing two interviews to run simultaneously in the same time slot.

**V2 changes vs the original:**
- Schedule runs **7 days a week** (Saturday and Sunday included) — no more Mon–Fri-only constraint
- Day 1 = `SCHEDULE_START_DATE` exactly — no Monday-snapping
- Candidates can specify **specific calendar dates they are not available** (`blockedDates`), which are hard-excluded from scheduling
- Availability scoring is now **calendar-aware** — it accounts for blocked dates when ranking candidates
- Day-of-week is derived from the actual calendar date, not a hardcoded cyclic index
- Three **night slots** added (`9:30PM-10:30PM`, `10:30PM-11:30PM`, `11:30PM-12:30AM`) — everyone assumed free for these on all 7 days (not present in CSV form, added manually)

---

## People Involved

| Role | Person(s) | Description |
|------|-----------|-------------|
| **SMPC** | Sara Atnoorkar, Amritansh Joshi | Student Mentorship Program Coordinators. At least one **must** be present in every interview. They are the primary scheduling bottleneck. |
| **Reviewer** | Rohan Mehta, Priya Nair | Senior reviewers who pair with an SMPC to form a complete panel. Their presence is preferred but not mandatory. |
| **Candidate** | 390 applicants (from CSV) | The people being interviewed. |

---

## Panel Structure

Every interview has **exactly 2 interviewers**. Solo panels are not allowed. The composition is determined by a three-tier priority:

| Priority | Panel Composition | When Used |
|---|---|---|
| **1 (preferred)** | SPMC + Reviewer | Whenever a reviewer is free in the same slot |
| **2 (last resort)** | SPMC + other SPMC | Only when no reviewer is available — both SPMCs consumed |
| **3** | Solo SPMC | Never allowed |

Examples:
- `Sara + Rohan` — Tier 1 full panel (frees Amritansh for a concurrent interview)
- `Amritansh + Priya` — Tier 1 full panel
- `Sara + Amritansh` — Tier 2 last resort (no reviewer was free; no concurrent panel possible this slot)

> **Why Tier 2 is last resort**: A both-SPMC panel consumes both Sara and Amritansh simultaneously, making it impossible to run a concurrent second panel that slot. It should only be used when it is the only way to schedule a candidate.

---

## Simultaneous Panels (The Key Throughput Gain)

Two panels can run **at the same time slot on the same day** provided they use **different SMPCs**:

| Scenario | Valid? | Reason |
|---|---|---|
| Sara + Rohan **AND** Amritansh + Priya at 9:30AM | Yes | Different SMPCs, both free |
| Sara + Rohan **AND** Sara + Priya at 9:30AM | No | Sara double-booked |
| Sara + Amritansh (both-SPMC panel) at any slot | No concurrent panel possible | Both SMPCs are consumed |

This effectively **doubles the maximum throughput** compared to the old single-panel system — as long as Tier 1 panels (SPMC + Reviewer) are used. Tier 2 (both-SPMC) panels forfeit this concurrency benefit.

---

## Algorithm — Step by Step

### Step 1: Score and Sort Candidates

Before any assignment, every candidate gets an **availability score**:

```
score = sum over actual calendar days 1..60:
  IF the day is in candidate.blockedDates  →  skip (contributes 0)
  ELSE:
    Tier 1 slots: (candidate AND SMPC AND Reviewer overlap)  x  10  per reviewer
    Tier 2 slots: (candidate AND both SMPCs overlap)         x   1
```

- Iterating real calendar days (not just 7 day-of-week names) means **blocked dates reduce the score**. A candidate who is free every Monday but has every Monday in March blocked will score lower than one with genuinely open slots.
- The window is capped at **60 days** for performance — we only need a relative ordering.
- Tier 1 (SMPC + Reviewer) slots are weighted **x10** — these are the slots that allow concurrent panels and should be maximally preferred.
- Tier 2 (both-SPMC) slots get weight **x1** — they still count so a candidate with only these options isn't scored zero, but they're heavily deprioritised.

Candidates are sorted **ascending by score** — lowest (hardest to schedule) goes first. This prevents flexible candidates from hoarding prime slots before the constrained ones get a chance.

---

### Step 2: Find a Panel for Each Candidate

For each candidate, the algorithm walks through days `1, 2, 3, ...` until a valid panel is found.

On each day, `findPanelForCandidateOnDay()` runs:

```
--- Pre-check: Blocked Dates ---
Compute the real calendar date for this dayNumber:
  date = SCHEDULE_START_DATE + (dayNumber - 1) days
If date is in candidate.blockedDates → return null immediately (skip this day)

--- Tier 1: SMPC + Reviewer ---
for each SMPC (Sara, Amritansh):
  for each Reviewer (Rohan, Priya):
    find slots where candidate + SMPC + Reviewer are all available
    for each such slot:
      1. Is the SMPC free this slot?      (personBookings)
      2. Is the Reviewer free this slot?  (personBookings)
      if both pass -> add to Tier 1 options
if Tier 1 has any options -> pick earliest slot, done

--- Tier 2: SMPC + SMPC (last resort) ---
find slots where candidate + Sara + Amritansh are ALL available
for each such slot:
  1. Is Sara free? (personBookings)
  2. Is Amritansh free? (personBookings)
  if both pass -> add to Tier 2 options
if Tier 2 has any options -> pick earliest slot

otherwise -> candidate cannot be scheduled this day, try day + 1
```

---

### Step 3: Book the Slot

```
personBookings.add(SMPC + day + slot)       // SMPC can't be re-used this slot
personBookings.add(partner + day + slot)    // Reviewer or second SMPC can't be re-used
```

Concurrency is naturally enforced: if Sara is already booked in a slot, `isPersonFree(Sara)` returns false, so she cannot be assigned to any second panel in that slot. A both-SMPC panel books both Sara and Amritansh, making concurrent panels impossible that slot without any separate tracker.

The stored interview record:

| Field | Value |
|---|---|
| `oc1Id` | The **primary SMPC** for this panel (Sara OR Amritansh) |
| `oc2Id` | The **other SMPC** — is the actual partner in Tier 2; stored for DB compat in Tier 1 |
| `reviewer1Id` | The reviewer (Tier 1 only, null for Tier 2 both-SMPC panels) |
| `panelId` | Human-readable e.g. `"Sara Atnoorkar+Rohan Mehta"` or `"Sara Atnoorkar+Amritansh Joshi"` |

---

### Step 4: Handle Unscheduled Candidates

If no panel is found across all days, the candidate is flagged with one of two reasons:

- `"No overlapping slots with any interviewer within the scheduling window"` — score was 0, meaning zero SMPC overlap across the scoring window after accounting for blocked dates
- `"No slot found in scheduling period"` — had some SMPC overlap on non-blocked days, but every matching slot was already taken by other candidates

---

## Booking Tracker

A single data structure enforces all constraints:

### `personBookings` — Set of strings
Prevents any individual from being double-booked.
- Key: `"<personId>-day<N>-<slot>"`
- Covers all four interviewers: Sara, Amritansh, Rohan, Priya

Concurrency falls out naturally: because each person can only appear once per slot, an SPMC in a Tier 1 panel is blocked from a second panel that same slot (they're already in `personBookings`). A both-SPMC Tier 2 panel books *both* SMPCs, so neither can participate in a concurrent panel. No separate tracker is needed.

---

## Time and Date Handling

Availability slots use the format `"9:30AM-10:30AM"`. The parser extracts the start time and converts from **IST to UTC** (IST = UTC+5:30) before storing in the database:

```
UTC hours = IST hours - 5
UTC mins  = IST mins  - 30   (borrow 1 hour if negative)
```

### Day Number → Calendar Date

Day numbers map to real calendar dates starting from `SCHEDULE_START_DATE` with **no Monday-snapping**:

```
calendarDate(dayNumber) = SCHEDULE_START_DATE + (dayNumber - 1) days
```

Examples with `SCHEDULE_START_DATE = 2026-03-01` (Sunday):

```
Day 1  = 2026-03-01  (Sunday)
Day 2  = 2026-03-02  (Monday)
Day 3  = 2026-03-03  (Tuesday)
Day 7  = 2026-03-07  (Saturday)
Day 8  = 2026-03-08  (Sunday)
...
```

Week 1 = Days 1–7, Week 2 = Days 8–14, etc. The schedule runs all 7 days — **there are no skipped weekends**.

### Day-of-Week → Availability Key (`getDayName`)

To look up a candidate's or interviewer's availability for a given day number, the algorithm computes the real calendar date and derives the weekday from it:

```javascript
function getDayName(dayNumber, startDate) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (dayNumber - 1));
  return JS_TO_DAY_NAME[d.getDay()]; // 'sunday', 'monday', ...
}
```

This is **not** a modulo index into a fixed array — it is the actual JS `Date.getDay()` result. This means the scheduler is correct regardless of what day of the week `SCHEDULE_START_DATE` falls on.

### Blocked Dates (`blockedDates`)

Candidates can provide specific calendar dates on which they are unavailable (e.g., exam dates, travel). These are stored as an array of ISO date strings on the `Candidate` record:

```json
"blockedDates": ["2026-03-09", "2026-03-10", "2026-03-11"]
```

They are sourced from the **"dates not available"** column in the Google Form CSV (`dd/MM/yyyy` format, comma-separated). The seed script converts them:

```
"09/03/2026, 10/03/2026" → ["2026-03-09", "2026-03-10"]
```

During scheduling, **two places** enforce blocked dates:

1. **`findPanelForCandidateOnDay`** — computes `SCHEDULE_START_DATE + (dayNumber-1)`, checks against `blockedDates`, and returns `null` immediately if matched. The day loop advances to the next day.
2. **`calculateAvailabilityScore`** — skips blocked calendar days when summing the score. This means a heavily-blocked candidate scores lower (fewer real options) and is scheduled earlier (hardest-first), reducing the risk they end up unscheduled.

Blocked dates never permanently unschedule a candidate — the algorithm simply keeps advancing day numbers until it finds a non-blocked day with an available panel slot.

---

## Available Days & Time Slots

All 7 days of the week are now valid scheduling days. OCs, Reviewers, and all candidates have `saturday` and `sunday` keys in their availability, all set to fully free (all 8 slots) unless individually restricted.

| Slot String | IST Time |
|---|---|
| `9:30AM-10:30AM` | 9:30 – 10:30 |
| `10:30AM-11:30AM` | 10:30 – 11:30 |
| `11:30AM-12:30PM` | 11:30 – 12:30 |
| `12:30PM-2PM` | 12:30 – 14:00 |
| `2PM-3:30PM` | 14:00 – 15:30 |
| `3:30PM-5PM` | 15:30 – 17:00 |
| `5:30PM-7PM` | 17:30 – 19:00 |
| `7PM-8:30PM` | 19:00 – 20:30 |
| `9:30PM-10:30PM` | 21:30 – 22:30 |
| `10:30PM-11:30PM` | 22:30 – 23:30 |
| `11:30PM-12:30AM` | 23:30 – 00:30 |

---

## Output Stats

| Field | Description |
|---|---|
| `scheduled` | Candidates successfully assigned a slot |
| `unscheduled` | Candidates who could not be placed |
| `daysUsed` | Highest day number used across all interviews |
| `weeksUsed` | `ceil(daysUsed / 7)` |
| `concurrentSlots` | Number of day+time slots where two interviews run simultaneously |
| `interviewsByDay` | Per-day count of interviews |

---

## Design Decisions

| Choice | Reason |
|---|---|
| Panels always exactly 2 people | Ensures interview quality — every candidate always faces two interviewers |
| Hardest-to-schedule candidates first | Prevents flexible candidates from taking all prime slots |
| Tier 1 score weight x10 over Tier 2 | SMPC+Reviewer slots are vastly preferable — they allow concurrency |
| Both-SMPC as last resort, not forbidden | Strictly increases the number of schedulable candidates without compromising the 2-person rule |
| `oc2Id` stores the other SMPC | Preserves DB schema compatibility; in Tier 2 panels this field is the actual second interviewer |
| 7-day scheduling (Sat + Sun included) | OCs and reviewers are free on weekends; including them reduces total days needed and gives more flexibility for blocked-date candidates |
| `Day 1 = SCHEDULE_START_DATE` exactly | No Monday-snapping — the schedule starts on whatever day the admin sets, making `SCHEDULE_START_DATE` a true anchor |
| `getDayName` uses `Date.getDay()` | Deriving weekday from a real calendar date is correct regardless of start day; a cyclic `% 7` index would be wrong if the start date is not a Monday |
| Blocked dates checked in both scoring and panel-finding | Scoring ensures heavily-blocked candidates are scheduled first (hardest-first); panel-finding ensures they are never placed on a blocked date |
| Default weekend window restricts slots | Avoids early-morning slots on weekends without editing any individual availability row |
| Tier 1 tiebreaker = least-loaded panel | Prevents one (SPMC, reviewer) pair from dominating the schedule — all 4 combinations (Ojas+Diya, Ojas+Aagam, Dev+Diya, Dev+Aagam) get roughly equal share |

---

## Panel Load Balancing

### Problem

All 4 valid Tier 1 panel combinations are logically equivalent in terms of constraints:

| SPMC | Reviewer |
|------|----------|
| Ojas | Diya |
| Ojas | Aagam |
| Dev  | Diya |
| Dev  | Aagam |

Without deliberate balancing, the Tier 1 sort (earliest slot first) is a stable sort over the iteration order of the `spmcs × reviewers` nested loop. Whichever combination appears first in that loop wins every tie — in practice this meant **Dev+Aagam appeared on nearly every interview** while Dev+Diya and Ojas+anything were rarely used.

### Fix — `assignmentCount` Tiebreaker

A per-person assignment counter is maintained alongside `personBookings`:

```javascript
const assignmentCount = {};
[...spmcs, ...reviewers].forEach(p => { assignmentCount[p.id] = 0; });
```

After every booking, both panel members are incremented:

```javascript
bookPerson(spmc.id, day, slot);
bookPerson(partner.id, day, slot);
assignmentCount[spmc.id]++;
assignmentCount[partner.id]++;
```

The Tier 1 sort uses this as a **secondary key** (primary is still earliest slot):

```javascript
tier1.sort((a, b) => {
  // Primary: earliest slot
  const slotDiff = (parseSlotTime(a.slot).minutes + ...) - (...);
  if (slotDiff !== 0) return slotDiff;
  // Tiebreaker: least-loaded panel
  const loadA = assignmentCount[a.spmc.id] + assignmentCount[a.partner.id];
  const loadB = assignmentCount[b.spmc.id] + assignmentCount[b.partner.id];
  return loadA - loadB;
});
```

This means:
- If two combinations offer the same earliest slot, the one whose members have done fewer interviews so far is picked.
- Over hundreds of candidates, this distributes interviews roughly evenly across all 4 panel pairings.
- The primary scheduling goal (earliest slot = fewest total days used) is completely unchanged.

### What this does NOT change

- The slot a candidate is assigned to is still the earliest possible — load balancing only breaks ties at the same slot.
- The total number of scheduled candidates is unchanged.
- Tier 2 (both-SPMC) panels are unaffected — there is only one possible combination there.

---

## Weekend Time Overrides

### Problem

OCs and reviewers are free all day on weekends by default (all 11 slots). In practice there may be days where the weekend session needs to start later or end earlier — exam season, public holidays, etc. Rather than editing every availability row in the DB, the system supports a **per-date window override** that trims which slots the scheduler may use on that specific date.

### Data Model

```prisma
model WeekendOverride {
  id        String   @id @default(cuid())
  date      String   @unique   // ISO "YYYY-MM-DD", must be Saturday or Sunday
  startSlot String             // e.g. "11:30AM-12:30PM"
  endSlot   String             // e.g. "7PM-8:30PM"
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([date])
  @@map("weekend_overrides")
}
```

Each row represents one weekend day. Upsert semantics — saving the same date again replaces the previous record.

### Default Window

When no override exists for a weekend date the scheduler uses:

```
DEFAULT_WEEKEND_START = '11:30AM-12:30PM'
DEFAULT_WEEKEND_END   = '11:30PM-12:30AM'
```

9 of the 11 slots are available by default (`9:30AM-10:30AM` and `10:30AM-11:30AM` excluded). The seed script seeds OC/reviewer weekend availability with these same 9 slots.

### How `scheduler.js` Applies the Window

`getAllowedSlots(date, weekendOverrides)` is called for every calendar day during scheduling:

```javascript
function getAllowedSlots(date, weekendOverrides) {
  const dow = new Date(date).getUTCDay(); // 0=Sun, 6=Sat
  if (dow !== 0 && dow !== 6) return null; // weekday — no restriction

  const ov = weekendOverrides[date] || {
    startSlot: DEFAULT_WEEKEND_START,
    endSlot:   DEFAULT_WEEKEND_END,
  };
  const startIdx = ALL_SLOTS_ORDERED.indexOf(ov.startSlot);
  const endIdx   = ALL_SLOTS_ORDERED.indexOf(ov.endSlot);
  return new Set(ALL_SLOTS_ORDERED.slice(startIdx, endIdx + 1));
}
```

Returns `null` (no restriction) for weekdays, or a `Set<string>` of allowed slot labels for a weekend date. Inside `scheduleInterviews()` every slot candidate is filtered through this set:

```javascript
const allowedSlots = getAllowedSlots(dateStr, weekendOverrides);
const candidateSlots = rawSlots.filter(s => !allowedSlots || allowedSlots.has(s));
```

The same filter applies to SMPC and reviewer slot lists — so a slot outside the window is **globally unreachable** on that day regardless of individual availability. `weekendOverrides` is fetched from the DB in `pages/api/schedule.jsx` and passed into `scheduleInterviews()` on every fresh run.

### Applying an Override to an Existing Schedule

Saving an override only affects future scheduling runs. To retroactively move already-scheduled interviews that fall outside the new window, the admin clicks **Apply**. This calls `applyWeekendOverride(date, startSlot, endSlot)` in `lib/rescheduleLogic.js`.

#### Steps

1. **Find trimmed interviews** — fetch all non-completed interviews on that `dayNumber` whose stored UTC `startTime` maps to a slot outside the new window.
2. **Find append point** — `appendFromDay = max(dayNumber across all scheduled interviews) + 1`.
3. **Re-place each trimmed interview** — iterate days from `appendFromDay` upward, checking candidate `blockedDates`, panel-member availability, and `personBookings` (same logic as the main scheduler). Compute new UTC `startTime` via `parseSlotTime` + `calculateScheduledTime`.
4. **Commit atomically** — Prisma transaction: `deleteMany` trimmed + `createMany` re-placed. Interviews that could not be placed are reported but the rest are still committed.

#### What it does NOT touch

- Interviews already inside the new window — completely undisturbed.
- The rest of the schedule — displaced interviews go *after* the last scheduled day, nothing else shifts.
- Previously applied moves — removing an override record does not move interviews back.

#### Return value

```javascript
{
  success: true,
  moved: 3,
  couldNotPlace: 0,
  message: "Moved 3 interview(s). 0 could not be placed.",
  details: [
    { candidateName: "Alice", from: "Day 7 / 9:30AM-10:30AM", to: "Day 15 / 11:30AM-12:30PM" },
    { candidateName: "Bob",   from: "Day 7 / 10:30AM-11:30AM", error: "No free slot found" },
  ]
}
```

### API (`/api/weekend-overrides`)

| Method | Body | Action |
|--------|------|--------|
| `GET` | — | All override records ordered by date |
| `POST` | `{ date, startSlot, endSlot, note? }` | Upsert override (validates Sat/Sun, slot order) |
| `PUT` | `{ date }` | Apply override — calls `applyWeekendOverride`, returns move details |
| `DELETE` | `{ date }` | Remove override record (does not undo applied moves) |

### UI (`/weekend-overrides`)

Linked from the home screen. Three sections:

- **Info banner** — explains the default window and the Save → Apply two-step workflow.
- **Add / Update form** — date picker (Sat/Sun only), start/end slot selects (end choices constrained to ≥ start), optional note.
- **Saved overrides list** — cards colour-coded purple (Saturday) / orange (Sunday), each with an **Apply** button (moves trimmed interviews, shows per-candidate result) and a **Remove** button.

### Design Decisions

| Choice | Reason |
|--------|--------|
| `startSlot`/`endSlot` strings, not a bitmask | Consistent with slot representation everywhere else; human-readable in the DB |
| Default window applied when no row exists | Constraint is on by default — no need to pre-populate future weekends |
| Displaced interviews go after the last scheduled day | Existing schedule is completely undisturbed; only the out-of-window interviews move |
| Atomic transaction (delete + create) | Prevents partial state if writes fail mid-way |
| Save and Apply are separate actions | Admin can review or adjust the window before committing the move; applying is intentionally irreversible |
| `couldNotPlace` reported but not rolled back | Moving 8 of 10 is better than leaving all 10 in a violated window |
