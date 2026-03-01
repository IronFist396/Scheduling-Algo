# ISMP Interview Scheduling Logic (Two-Panel Algorithm)

## Overview

The scheduler assigns interview slots to candidates from the ISMP Mentors application pool. It uses a **two-panel, greedy algorithm** that maximises throughput by allowing two interviews to run simultaneously in the same time slot.

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
score = sum over all days:
  Tier 1 slots: (candidate AND SMPC AND Reviewer overlap)  x  10  per reviewer
  Tier 2 slots: (candidate AND both SMPCs overlap)         x   1
```

- Tier 1 (SMPC + Reviewer) slots are weighted **x10** — these are the slots that allow concurrent panels and should be maximally preferred.
- Tier 2 (both-SPMC) slots get weight **x1** — they still count so a candidate with only these options isn't scored zero, but they're heavily deprioritised.

Candidates are sorted **ascending by score** — lowest (hardest to schedule) goes first. This prevents flexible candidates from hoarding prime slots before the constrained ones get a chance.

---

### Step 2: Find a Panel for Each Candidate

For each candidate, the algorithm walks through days `1, 2, 3, ...` until a valid panel is found.

On each day, `findPanelForCandidateOnDay()` runs in two tiers:

```
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

otherwise -> candidate cannot be scheduled this day
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

- `"No available slots with any SMPC"` — score was 0, meaning zero SMPC overlap in their entire availability
- `"No slot found in scheduling period"` — had some SMPC overlap, but every matching slot was already taken

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

Day numbers map to real calendar dates starting from the **first Monday on or after `SCHEDULE_START_DATE`**:

```
Day 1  = Week 1 Monday
Day 2  = Week 1 Tuesday
Day 3  = Week 1 Wednesday
Day 4  = Week 1 Thursday
Day 5  = Week 1 Friday
Day 6  = Week 2 Monday   (weekends are skipped)
...
```

---

## Available Time Slots

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

---

## Output Stats

| Field | Description |
|---|---|
| `scheduled` | Candidates successfully assigned a slot |
| `unscheduled` | Candidates who could not be placed |
| `daysUsed` | Highest day number used across all interviews |
| `weeksUsed` | `ceil(daysUsed / 5)` |
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
