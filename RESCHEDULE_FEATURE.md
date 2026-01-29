# Reschedule Feature Documentation

## Overview

The reschedule feature allows you to handle candidate unavailability by intelligently rescheduling interviews while maintaining optimal schedule quality. The system uses a two-tier approach to minimize disruption and prevent scheduling conflicts.

---

## How It Works

### **User Flow**

1. **Navigate to Dashboard**: View the weekly calendar of scheduled interviews
2. **Click on Interview**: Select the interview that needs to be rescheduled
3. **Click "Reschedule" Button**: Opens the reschedule confirmation modal
4. **Provide Reason**: Enter why the interview needs to be rescheduled (required)
5. **Confirm**: System automatically finds the best rescheduling solution

---

## Reschedule Algorithm

### **Tier 1: Smart Swap (Preferred)**

The system first attempts to find a **perfect swap candidate** from future weeks:

**Criteria:**
- Candidate scheduled in a future week (after current week)
- Same day of the week (Monday, Tuesday, etc.)
- Same time slot (e.g., 9:30 AM)
- Not yet completed

**Result:**
- Clean 1-to-1 swap
- Both candidates get interviewed
- Minimal disruption (only 2 people affected)

**Example:**
```
Week 2, Monday 9:30 AM - Candidate A (unavailable)
Week 5, Monday 9:30 AM - Candidate B (available)

After Swap:
Week 2, Monday 9:30 AM - Candidate B ✅
Week 5, Monday 9:30 AM - Candidate A ✅
```

---

### **Tier 2: Optimal Rebuild (Fallback)**

If no swap candidate is found, the system rebuilds all future weeks:

**Process:**
1. Extract the unavailable candidate from current week
2. Collect all candidates scheduled in future weeks
3. Add the unavailable candidate to this pool
4. Re-run the scheduling algorithm for future weeks only
5. Generate optimal schedule for all candidates

**Advantages:**
- Fills the gap optimally
- Uses the same constraint-based algorithm
- Reschedules the unavailable person fairly
- May improve overall schedule quality

**Protection:**
- Current week is **FROZEN** (not affected)
- Completed interviews are **PROTECTED** (never touched)
- Only future weeks are rescheduled

**Example:**
```
Week 2, Tuesday 10:30 AM - Candidate A (unavailable)

System Action:
1. Remove Candidate A from Week 2
2. Collect all future interviews (Weeks 3-50)
3. Re-run scheduler with Candidate A + future candidates
4. Generate new optimal schedule

Result:
- Week 2 gap is filled with best available candidate
- Candidate A gets rescheduled optimally
- All future weeks optimized
```

---

## Loop Prevention

The system prevents infinite reschedule loops (A→B→A):

**Detection:**
- Tracks the last candidate moved FROM each slot
- Checks timestamp of last reschedule
- Prevents same candidate from being moved back within 24 hours

**Error Message:**
```
"Loop detected! This candidate was just moved from this slot. 
Please wait 24 hours or choose manual intervention."
```

---

## Database Tracking

Each reschedule operation updates the following fields in the `Interview` table:

| Field | Description |
|-------|-------------|
| `lastRescheduledFrom` | Candidate ID who was moved FROM this slot |
| `lastRescheduledTo` | Candidate ID who was moved TO this slot |
| `lastRescheduledAt` | Timestamp of last reschedule |
| `rescheduleReason` | Why the interview was rescheduled |
| `rescheduleCount` | Number of times this slot has been rescheduled |

---

## API Endpoints

### **POST `/api/interview-action`**

**Request:**
```json
{
  "action": "reschedule",
  "interviewId": "clx123abc456",
  "reason": "Candidate unavailable due to medical emergency"
}
```

**Response (Swap Success):**
```json
{
  "success": true,
  "method": "SWAP",
  "message": "Successfully swapped John Doe with Jane Smith",
  "affectedCandidates": [
    {
      "name": "John Doe",
      "oldSlot": "Day 8",
      "newSlot": "Day 23"
    },
    {
      "name": "Jane Smith",
      "oldSlot": "Day 23",
      "newSlot": "Day 8"
    }
  ]
}
```

**Response (Rebuild Success):**
```json
{
  "success": true,
  "method": "REBUILD",
  "message": "Successfully rebuilt future schedule. 187 interviews rescheduled optimally.",
  "affectedCount": 188,
  "scheduled": 187,
  "unscheduled": 1
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Cannot reschedule a completed interview"
}
```

---

## UI Features

### **Reschedule Button**
- Appears in interview detail modal
- Only shown for `SCHEDULED` interviews (not completed/cancelled)
- Opens confirmation modal

### **Reschedule Modal**
- Shows candidate name and current slot
- Requires reason input (mandatory)
- Explains the two-tier approach
- Warns about potential impacts on future weeks
- Provides clear Cancel/Confirm actions

### **Feedback**
- Shows detailed results in alert message
- Lists affected candidates (for swaps)
- Shows statistics (for rebuilds)
- Error messages for edge cases

---

## Edge Cases Handled

### ✅ **Completed Interviews**
Cannot reschedule interviews marked as completed.

### ✅ **Loop Prevention**
Prevents A→B→A reschedule loops within 24 hours.

### ✅ **Current Week Protection**
Never touches interviews in the current week (happening soon).

### ✅ **No Available Slots**
If rebuild cannot schedule everyone, shows unscheduled count.

### ✅ **Missing OCs**
Validates that at least 2 OCs exist before rescheduling.

---

## Testing Scenarios

### **Test Case 1: Successful Swap**
1. Schedule initial interviews
2. Navigate to Week 2
3. Click on an interview
4. Click "Reschedule"
5. Enter reason: "Candidate unavailable"
6. Confirm
7. **Expected**: System finds swap, shows 2 affected candidates

### **Test Case 2: Rebuild Scenario**
1. Schedule interviews with unique time slots
2. Reschedule an interview with no swap candidates
3. **Expected**: System rebuilds future weeks, shows count

### **Test Case 3: Loop Prevention**
1. Reschedule Interview A (moves to Week 5)
2. Immediately reschedule Week 5 interview back to original slot
3. **Expected**: Error message about loop detection

### **Test Case 4: Completed Interview**
1. Mark an interview as "Done"
2. Try to reschedule it
3. **Expected**: Error message preventing reschedule

---

## Performance Considerations

- **Swap**: Very fast (~50ms) - simple database updates
- **Rebuild**: Moderate (~500ms-2s depending on candidate count)
  - Deletes future interviews
  - Runs scheduling algorithm
  - Inserts new schedule
  - Updates candidate statuses

---

## Future Enhancements (Not Implemented Yet)

1. **Email Notifications**: Auto-notify affected candidates
2. **Audit Log Table**: Track all reschedule operations separately
3. **Preview Mode**: Show impact before confirming
4. **Undo Feature**: Rollback recent reschedules
5. **Batch Reschedule**: Handle multiple unavailable candidates at once
6. **Smart Suggestions**: Show alternative manual slots before rebuild

---

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/rescheduleLogic.js` | Core reschedule algorithm (swap + rebuild) |
| `lib/interviewActions.js` | Wrapper function for reschedule |
| `pages/api/interview-action.js` | API endpoint handler |
| `components/ScheduleCalendar.jsx` | UI button and modal |
| `prisma/schema.prisma` | Database schema with tracking fields |

---

## Console Logging

The reschedule process logs detailed information:

```
📋 Rescheduling interview for John Doe
   Original slot: Day 8, Week 2
   Current week ends at Day 10

🔄 Attempting Tier 1: Exact Swap...
✅ Swap found: Jane Smith (Day 23)
```

Or:

```
🔄 Attempting Tier 1: Exact Swap...
🔨 Tier 1 failed. Attempting Tier 2: Rebuild Future Weeks...
🔄 Rescheduling 187 candidates from day 11...
✅ Rebuild complete: 187 interviews rescheduled
```

---

## Summary

The reschedule feature provides a robust, intelligent solution for handling candidate unavailability:

- **Smart**: Tries swap first, rebuilds only if needed
- **Safe**: Protects current week and completed interviews
- **Optimal**: Maintains schedule quality through algorithmic rebuild
- **Transparent**: Shows exactly what changed
- **Protected**: Prevents loops and edge cases

This approach ensures that schedule disruptions are minimized while maintaining fairness and optimality across all interviews.
