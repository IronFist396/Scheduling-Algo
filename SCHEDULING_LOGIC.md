# Interview Scheduling Algorithm - Detailed Overview

## Problem Statement

Schedule 390 candidates for ISMP mentor interviews with 2 OCs (Organizing Committee members), where:
- Each interview requires **both OCs to be present**
- Each interview lasts **60 minutes**
- Candidates and OCs have **weekly availability** (Monday-Friday only)
- Schedule should be fair and efficient

---

## Core Scheduling Philosophy

### Date-Independent Approach

The scheduler **does NOT use calendar dates**. Instead, it works with:
- **Day Numbers**: Day 1, Day 2, Day 3... (abstract scheduling units)
- **Week Mapping**: Days 1-5 = Week 1, Days 6-10 = Week 2, etc.
- **Weekly Availability**: Each day number maps to a weekday (Mon-Fri)

**Why?** Candidates provide their weekly free slots (e.g., "I'm free Monday 9:30-10:30 AM every week"), not specific calendar dates. The scheduler respects this by organizing interviews in a repeating weekly pattern.

---

## Algorithm Overview

### Type: **Greedy Day-Wise Scheduler with Constraint-Based Sorting**

### Key Features:
1. **Availability-Constrained-First**: Schedules candidates with fewer available slots first
2. **Day-Wise Assignment**: Tries to fill earliest available day for each candidate
3. **No Forced Filling**: Doesn't force Day 1 to be full before moving to Day 2
4. **Conflict Prevention**: Tracks booked slots to prevent double-booking

---

## Step-by-Step Process

### **Step 1: Data Preparation**

**Input Data:**
```javascript
// Candidates (from CSV)
{
  id: "cand123",
  name: "John Doe",
  availability: {
    monday: ["9:30AM-10:30AM", "2PM-3:30PM"],
    tuesday: ["10:30AM-11:30AM"],
    wednesday: [],
    thursday: ["9:30AM-10:30AM", "11:30AM-12:30PM"],
    friday: ["2PM-3:30PM"]
  }
}

// OCs (hardcoded in seed.js)
{
  id: "oc1",
  name: "Akash Palanisamy",
  availability: {
    monday: ["9:30AM-10:30AM", "10:30AM-11:30AM", "2PM-3:30PM"],
    tuesday: ["9:30AM-10:30AM", "10:30AM-11:30AM"],
    // ...
  }
}
```

---

### **Step 2: Availability Scoring**

Calculate how many total slot-day combinations each candidate has in common with **both OCs**:

```javascript
function calculateAvailabilityScore(candidate, oc1, oc2) {
  let totalSlots = 0;
  
  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
    const candidateSlots = candidate.availability[day] || [];
    const oc1Slots = oc1.availability[day] || [];
    const oc2Slots = oc2.availability[day] || [];
    
    // Find slots where ALL THREE are available
    const commonSlots = candidateSlots.filter(
      slot => oc1Slots.includes(slot) && oc2Slots.includes(slot)
    );
    
    totalSlots += commonSlots.length;
  }
  
  return totalSlots;
}
```

**Example:**
- Candidate A has 10 common slots across the week → Score = 10
- Candidate B has 2 common slots → Score = 2
- **Candidate B gets scheduled first** (fewer options = more constrained)

---

### **Step 3: Constraint-Based Sorting**

Sort candidates in **ascending order** of availability score:

```javascript
scoredCandidates.sort((a, b) => a.availabilityScore - b.availabilityScore);
```

**Why?** Candidates with fewer available slots are harder to schedule later. By scheduling them first, we maximize the chance of finding a slot for everyone.

---

### **Step 4: Greedy Day-Wise Scheduling**

For each candidate (in sorted order):

```javascript
for (const { candidate, availabilityScore } of scoredCandidates) {
  // Skip candidates with NO common availability
  if (availabilityScore === 0) {
    unscheduledCandidates.push(candidate);
    continue;
  }
  
  // Try to schedule starting from Day 1
  let scheduled = false;
  
  for (let day = 1; day <= maxDays && !scheduled; day++) {
    const availableSlots = findAvailableSlotsForDay(
      candidate, oc1, oc2, bookedSlots, day
    );
    
    if (availableSlots.length > 0) {
      // Book the EARLIEST slot on this day
      const selectedSlot = availableSlots[0];
      bookSlot(candidate, selectedSlot, day);
      scheduled = true;
    }
  }
  
  if (!scheduled) {
    unscheduledCandidates.push(candidate);
  }
}
```

**Key Point**: Each candidate gets the **earliest available slot** across all days, not necessarily on Day 1.

---

### **Step 5: Slot Booking & Conflict Prevention**

Track which slots are already booked using a Set:

```javascript
const bookedSlots = new Set();

function bookSlot(candidate, slot, dayNumber) {
  const slotKey = `day${dayNumber}-${slot}`; // e.g., "day1-9:30AM-10:30AM"
  
  if (bookedSlots.has(slotKey)) {
    throw new Error("Slot already booked!"); // Shouldn't happen
  }
  
  bookedSlots.add(slotKey);
  
  scheduledInterviews.push({
    candidateId: candidate.id,
    oc1Id: oc1.id,
    oc2Id: oc2.id,
    startTime: calculateStartTime(dayNumber, slot),
    endTime: calculateEndTime(dayNumber, slot),
    dayNumber: dayNumber,
    status: 'SCHEDULED'
  });
}
```

---

### **Step 6: Finding Available Slots for a Day**

```javascript
function findAvailableSlotsForDay(candidate, oc1, oc2, bookedSlots, dayNumber) {
  // Map dayNumber to weekday (Day 1=Monday, Day 2=Tuesday, etc.)
  const dayOfWeek = DAYS_OF_WEEK[(dayNumber - 1) % 5]; // e.g., "monday"
  
  const candidateSlots = candidate.availability[dayOfWeek] || [];
  const oc1Slots = oc1.availability[dayOfWeek] || [];
  const oc2Slots = oc2.availability[dayOfWeek] || [];
  
  // Find common slots
  const commonSlots = candidateSlots.filter(
    slot => oc1Slots.includes(slot) && oc2Slots.includes(slot)
  );
  
  // Filter out already-booked slots
  const availableSlots = commonSlots.filter(slot => {
    const slotKey = `day${dayNumber}-${slot}`;
    return !bookedSlots.has(slotKey);
  });
  
  // Sort by time (earliest first)
  return availableSlots.sort((a, b) => {
    const timeA = parseSlotTime(a);
    const timeB = parseSlotTime(b);
    return (timeA.hours * 60 + timeA.minutes) - (timeB.hours * 60 + timeB.minutes);
  });
}
```

---

## Day Number to Weekday Mapping

### Cyclic Pattern

```
Day 1  → Monday    (Week 1)
Day 2  → Tuesday   (Week 1)
Day 3  → Wednesday (Week 1)
Day 4  → Thursday  (Week 1)
Day 5  → Friday    (Week 1)
Day 6  → Monday    (Week 2)
Day 7  → Tuesday   (Week 2)
...
Day 156 → Monday   (Week 32)
Day 157 → Tuesday  (Week 32)
```

**Formula:**
```javascript
const weekNumber = Math.ceil(dayNumber / 5);
const dayOfWeek = DAYS_OF_WEEK[(dayNumber - 1) % 5];
```

---

## Time Slot Parsing

Available time slots are stored as strings like `"9:30AM-10:30AM"`.

```javascript
function parseSlotTime(slot) {
  // Extract start time from "9:30AM-10:30AM"
  const timeMatch = slot.match(/(\d+):(\d+)(AM|PM)/);
  if (!timeMatch) return null;
  
  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const meridiem = timeMatch[3];
  
  // Convert to 24-hour format
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  
  return { hours, minutes };
}
```

---

## DateTime Calculation (for Database Storage)

While the core logic is date-independent, we **do** store `startTime` and `endTime` as DateTime for:
1. **Interview Management Dashboard** (today's schedule, reschedule logic)
2. **Future integration** with calendar tools

```javascript
function calculateStartTime(dayNumber, slot, baseDate = new Date('2025-03-01')) {
  // Find first Monday on or after baseDate
  const firstMonday = new Date(baseDate);
  const startDayOfWeek = firstMonday.getDay();
  let daysToMonday = 0;
  
  if (startDayOfWeek === 0) daysToMonday = 1;       // Sunday
  else if (startDayOfWeek > 1) daysToMonday = 8 - startDayOfWeek; // Tue-Sat
  
  firstMonday.setDate(firstMonday.getDate() + daysToMonday);
  
  // Calculate offset from first Monday
  const dayOfWeek = DAYS_OF_WEEK[(dayNumber - 1) % 5];
  const weekNumber = Math.floor((dayNumber - 1) / 5);
  const dayIndex = DAYS_OF_WEEK.indexOf(dayOfWeek);
  const calendarDayOffset = weekNumber * 7 + dayIndex;
  
  const scheduledDate = new Date(firstMonday);
  scheduledDate.setDate(scheduledDate.getDate() + calendarDayOffset);
  
  // Set time
  const { hours, minutes } = parseSlotTime(slot);
  scheduledDate.setHours(hours, minutes, 0, 0);
  
  return scheduledDate;
}
```

**Example:**
- Base date: March 1, 2025 (Saturday)
- First Monday: March 3, 2025
- Day 1 at 9:30 AM → March 3, 2025 9:30 AM
- Day 6 at 10:30 AM → March 10, 2025 10:30 AM (next Monday)

---

## Output Statistics

After scheduling completes:

```javascript
{
  totalCandidates: 390,
  scheduled: 345,
  unscheduled: 42,
  daysUsed: 157,
  weeksUsed: 32,
  
  interviewsByDay: {
    1: 2,   // Day 1 has 2 interviews
    2: 2,   // Day 2 has 2 interviews
    3: 1,   // Day 3 has 1 interview
    4: 3,   // Day 4 has 3 interviews
    5: 3,   // Day 5 has 3 interviews
    // ...
    157: 2
  },
  
  unscheduledCandidates: [
    {
      candidate: { name: "...", id: "..." },
      reason: "No common available slots with both OCs",
      availabilityScore: 0
    }
  ]
}
```

---

## Why This Approach Works

### 1. **Fairness**
- Candidates with limited availability get priority
- Everyone gets the earliest possible slot

### 2. **Efficiency**
- Greedy approach is fast: O(n × d × s) where:
  - n = number of candidates
  - d = max days
  - s = slots per day (~8)
- For 390 candidates, runs in ~100ms

### 3. **Flexibility**
- No hardcoded calendar dates
- Easy to adjust OC availability
- Can re-run scheduler anytime

### 4. **Practicality**
- Respects weekly patterns (real-world availability)
- Avoids weekends automatically
- Handles edge cases (0 common slots)

---

## Limitations & Trade-offs

### ❌ Not Optimal
This is a **greedy algorithm**, not an optimal solution. It doesn't guarantee:
- Minimum number of days used
- Perfect load balancing across days
- Optimal packing of time slots

### ✅ But Good Enough
For 390 candidates and typical availability patterns:
- ~88% scheduling success rate (345/390)
- Completes in reasonable time (~157 days / 32 weeks)
- Easy to understand and debug

### 🔄 Alternative Approaches
For better results, could use:
- **Integer Linear Programming** (optimal, but slower)
- **Simulated Annealing** (near-optimal, more complex)
- **Genetic Algorithms** (good for large datasets)

---

## Example Walkthrough

### Candidates:
- Alice: 2 common slots (Mon 9:30AM, Tue 10:30AM)
- Bob: 8 common slots (many options)
- Charlie: 1 common slot (Thu 2PM)

### Scheduling Order:
1. **Charlie** (1 slot) → Day 4, Thursday 2PM
2. **Alice** (2 slots) → Day 1, Monday 9:30AM
3. **Bob** (8 slots) → Day 1, Monday 10:30AM (if available)

### Result:
```
Day 1 (Monday):    Alice (9:30AM), Bob (10:30AM)
Day 2 (Tuesday):   (empty or other candidates)
Day 3 (Wednesday): (empty)
Day 4 (Thursday):  Charlie (2PM)
Day 5 (Friday):    (empty or other candidates)
```

---

## Integration with UI

The scheduler outputs:
```javascript
{
  candidateId: "abc123",
  oc1Id: "oc001",
  oc2Id: "oc002",
  startTime: "2025-03-03T04:00:00.000Z", // 9:30 AM IST
  endTime: "2025-03-03T05:00:00.000Z",   // 10:30 AM IST
  dayNumber: 1,
  status: "SCHEDULED"
}
```

The calendar UI:
1. Fetches all interviews for a week (e.g., Days 1-5)
2. Maps `dayNumber` to weekday column (Day 1 → Monday)
3. Extracts time from `startTime` and maps to row
4. Displays interview card in correct grid cell

---

## Future Enhancements

### Possible Improvements:
1. **Multi-OC Support**: Allow different OC pairs for different interviews
2. **Break Times**: Add mandatory breaks between interviews
3. **Candidate Preferences**: Weight by department or year
4. **Room Allocation**: Assign physical/virtual rooms
5. **Conflict Resolution**: Interactive UI to manually adjust conflicts
6. **Email Notifications**: Auto-send calendar invites
7. **Analytics Dashboard**: Visualize scheduling efficiency

---

## Conclusion

This scheduling algorithm provides a **practical, efficient, and fair** solution for ISMP mentor interviews. It prioritizes constrained candidates, respects weekly availability patterns, and produces human-readable schedules organized by week and day.

The date-independent approach ensures flexibility and clarity, while the greedy strategy ensures fast execution and easy debugging.
