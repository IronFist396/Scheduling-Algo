# ISMP Interview Rescheduling Logic

## Overview

When a candidate cannot attend their scheduled slot, the system runs a **two-tier rescheduling strategy**. The guiding principle is minimal disruption — touch as few existing interviews as possible.

**V2 changes to rescheduling:**
- Week boundaries use 7-day weeks (`ceil(dayNumber / 7) * 7`) — no more 5-day weeks
- Day-of-week is derived from the actual calendar date (`Date.getDay()` on `SCHEDULE_START_DATE + dayNumber - 1`), not a modulo index
- **Blocked dates are enforced in all three reschedule paths** — a candidate can never land on a date in their `blockedDates` via any reschedule route

---

## Tier 1 — Same-Slot Swap (zero disruption)

### Idea

Find another candidate who is scheduled in a **future week** at the **exact same weekday and time**. Swap the two candidates between their slots.

### Why no availability re-check is needed

Candidate availability is weekly and repeating. If candidate B is scheduled on "Monday 9:30AM" in Week 5, they are available every Monday 9:30AM by definition — including the displaced candidate's slot in an earlier week. The swap is **guaranteed valid** without any extra availability lookup.

### Algorithm

```
1. currentWeekEnd = ceil(dayNumber / 7) * 7

2. Compute targetDayOfWeek = Date.getDay() on (SCHEDULE_START_DATE + dayNumber - 1)
   — this is the real JS weekday (0=Sun … 6=Sat), NOT (dayNumber-1) % 7

3. Find future interviews where:
   - dayNumber > currentWeekEnd
   - Date.getDay() on (SCHEDULE_START_DATE + future.dayNumber - 1) == targetDayOfWeek
   - startTime UTC hours + minutes match (same time slot)
   - displaced candidate does NOT have the swap target's calendar date in blockedDates
   - swap target candidate does NOT have the displaced candidate's calendar date in blockedDates
   - loop guard: same candidate was not moved here < 24h ago

4. Pick the earliest future week match (minimises schedule extension).

5. Swap candidateId on the two interview records.
   Panel composition (SMPC + reviewer) stays on each slot unchanged.
   Both candidates remain SCHEDULED.
```

### Blocked Dates in Tier 1

Both sides of the swap are checked symmetrically before accepting any match:

```
isCandidateBlocked(displaced, future.dayNumber)   → skip if true (A can't go to that date)
isCandidateBlocked(swapTarget, original.dayNumber) → skip if true (B can't go to that date)
```

If all future same-slot candidates are blocked or loop-guarded, Tier 1 fails and Tier 2 runs.

### Result

Exactly **2 DB rows updated**. No other interview is touched. Schedule length is unchanged.

---

## Tier 2 — Backfill + Partial Rebuild (when no swap exists)

Used when Tier 1 finds no match — e.g. the displaced candidate is in the last scheduled week, or all future same-slot interviews have active loop guards.

### Constraint

**Current week's other interviews are never touched.** One candidate's unavailability must not cascade to everyone else that week.

---

### Step A — Backfill the vacated slot

The displaced candidate's slot (e.g. Week N, Sunday 9:30AM) is now empty. Before touching future weeks, attempt to fill it from the **rebuild pool** (displaced candidate + all currently PENDING candidates).

```
Derive the real weekday from the calendar date (not % 7):
  vacatedDate = SCHEDULE_START_DATE + (vacatedDayNumber - 1) days
  dayOfWeek   = JS_TO_DAY_NAME[vacatedDate.getDay()]   // e.g. 'sunday'

Reconstruct the slot's time string from its stored UTC startTime:
  IST hours = UTC hours + 5  (borrow if minutes overflow)
  IST mins  = UTC mins  + 30
  Format as e.g. "9:30AM"

For each candidate in the pool:
  isoDate = SCHEDULE_START_DATE + (vacatedDayNumber - 1) days  → "YYYY-MM-DD"
  If isoDate is in candidate.blockedDates → skip (candidate unavailable that date)
  Does candidate.availability[dayOfWeek] contain a slot starting at that time?
  If yes:
    Assign them to the vacated slot
    Reuse the existing panel (SMPC + reviewer) as-is — no re-composition needed
    Remove them from the pool
    Stop scanning

If no one fits:
  Delete the vacated slot (leave it empty)
```

No panel re-composition is needed because the slot already has a booked SMPC + reviewer — we are only changing the candidate sitting in that chair.

---

### Step B — Partial rebuild from Week N+1 only

```
currentWeekEnd = ceil(displaced.dayNumber / 7) * 7

Pool = displaced candidate
     + all PENDING candidates
     + candidates whose future interviews (dayNumber > currentWeekEnd) are about to be deleted

Delete all non-completed interviews with dayNumber > currentWeekEnd
Reset those candidates to PENDING

Run scheduleInterviews(pool, SMPCs, reviewers, SCHEDULE_START_DATE, 999)
Keep only results where dayNumber >= currentWeekEnd + 1

Insert new interviews, mark candidates as SCHEDULED
Any candidate the scheduler could not place stays PENDING
```

The scheduler's **"hardest first, earliest day"** ordering naturally fills Week N+1 before extending to Week N+2 and beyond — so the schedule stays as compact as possible.

**Blocked dates in Step B:** `scheduleInterviews` enforces `blockedDates` in two places internally:
- `calculateAvailabilityScore` — skips blocked calendar days when scoring, so heavily-blocked candidates are still scheduled first
- `findPanelForCandidateOnDay` — returns `null` immediately if the day's calendar date is in the candidate's `blockedDates`

No extra handling is needed in the rebuild path — the core scheduler already guarantees correctness.

---

## Full Flow Diagram

```
reschedule(interviewId)
        |
        v
  [Tier 1] currentWeekEnd = ceil(dayNumber / 7) * 7
           targetWeekday  = Date.getDay(SCHEDULE_START_DATE + dayNumber - 1)
           Find future interview with same calendar weekday + same UTC time
        |
   Found? --YES--> Both blocked-date checks pass?  --NO--> skip, try next
        |                    |
        |                   YES
        |                    v
        |          Swap candidates on the two records
        |                    --> return SWAP result
        NO
        |
        v
  Build pool: displaced + PENDING + future-week candidates (with blockedDates fetched)
        |
        v
  [Step A] Scan pool for someone who fits the vacated slot
           (weekday from calendar date; skip if candidate's blockedDates contains vacated date)
        |
   Found? --YES--> Assign them to vacated slot (reuse panel)
        |          Remove from pool
        NO
        |          (vacated slot gets deleted)
        |
        v
  [Step B] Delete future interviews (Week N+1+)
           Rebuild with remaining pool via scheduleInterviews()
           (blockedDates enforced automatically inside the scheduler)
           --> return REBUILD result
```

---

## Design Decisions

| Decision | Reason |
|---|---|
| Tier 1 checks same weekday AND same time | Guarantees the panel's time slot is usable, not just the calendar day |
| No availability re-check in Tier 1 | Weekly repeating availability makes it redundant — avoids an extra DB query |
| Backfill reuses existing panel | Avoids re-running panel formation logic for a single slot |
| Current week never touched in Tier 2 | One candidate's issue should not displace everyone else that week |
| Pool includes deleted future-week candidates | Their interviews are being removed anyway — better to re-optimise than leave gaps |
| Displaced candidate gets PENDING if unschedulable | Honest state, visible in the dashboard for manual intervention |
| Loop guard (24h window) | Prevents A → B → A ping-pong swaps within the same day |
| Week boundary uses `ceil(dayNumber / 7) * 7` | 7-day weeks (Sat + Sun included) — old code used `/ 5` which skipped weekends |
| Day-of-week derived from `Date.getDay()` on real calendar date | Correct for any start day; `(dayNumber-1) % 7` would be wrong if `SCHEDULE_START_DATE` is not a Monday |
| Blocked dates checked symmetrically in Tier 1 swap | Both the displaced candidate and the swap target must be free on their new dates |
| Blocked dates checked in Tier 2 backfill before availability | Avoids placing a candidate on a date they've hard-blocked even if their weekly availability says they're free |
| Blocked dates in Tier 2 rebuild delegated to the core scheduler | `scheduleInterviews` already enforces `blockedDates` in scoring and panel-finding — no duplication needed |

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Displaced candidate is in the last scheduled week | Tier 1 finds nothing. Tier 2 may extend the schedule by 1+ weeks |
| Backfill pool is empty (no PENDING, no future weeks) | Vacated slot deleted. Displaced candidate stays PENDING |
| Loop detected on all Tier 1 candidates | All swap matches skipped. Falls through to Tier 2 |
| Completed interview reschedule attempted | Rejected immediately — completed interviews are immutable |
| Scheduler cannot place displaced candidate in rebuild | Candidate remains PENDING — no forced slot created |
| Every future same-slot candidate has the original date blocked | All Tier 1 candidates rejected. Falls through to Tier 2 |
| Displaced candidate has the vacated date blocked | Backfill skips them. They go into the rebuild pool and are placed on a non-blocked day |
| All pool candidates have the vacated date blocked | Vacated slot deleted (no backfill). Rebuild proceeds normally — no one is forced onto a blocked date |
| Start date is a Saturday or Sunday | Day-of-week derivation uses `Date.getDay()` on the real date — swap matching and backfill are always correct regardless of start weekday |
