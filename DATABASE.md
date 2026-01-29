# Interview Scheduler - Database Documentation

## Overview

The Interview Scheduler uses **PostgreSQL** with **Prisma ORM** to store and manage interview scheduling data. This document explains the database schema, how data flows through the system, and what gets stored after scheduling.

---

## Database Schema

### 1. **Candidates Table**

Stores information about all candidates who applied for the ISMP mentor position.

```sql
CREATE TABLE candidates (
  id STRING PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  rollNumber TEXT UNIQUE NOT NULL,
  department TEXT,
  year TEXT,
  hostel TEXT,
  contactNumber TEXT,
  availability JSON,
  comments TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Example Record:**
```json
{
  "id": "clu123abc456",
  "name": "Karthikeyan Jaganathan",
  "email": "karthikeyanj@iitb.ac.in",
  "rollNumber": "21d170021",
  "department": "Energy Science and Engineering",
  "year": "4th year, DD/IDDDP/M.Sc.",
  "hostel": "5",
  "contactNumber": "9008132066",
  "availability": {
    "monday": ["9:30AM-10:30AM", "10:30AM-11:30AM", "7PM-8:30PM"],
    "tuesday": ["9:30AM-10:30AM", "10:30AM-11:30AM", "11:30AM-12:30PM", "2PM-3:30PM"],
    "wednesday": ["9:30AM-10:30AM", "2PM-3:30PM", "3:30PM-5PM"],
    "thursday": ["10:30AM-11:30AM", "11:30AM-12:30PM", "7PM-8:30PM"],
    "friday": ["9:30AM-10:30AM", "10:30AM-11:30AM", "2PM-3:30PM", "3:30PM-5PM"]
  },
  "comments": "Available for interviews in March-April",
  "createdAt": "2025-02-19T15:18:35Z"
}
```

**Data Source:** Populated from CSV file via `prisma/seed.js`

---

### 2. **OCs Table**

Stores information about the two Organizing Committee members who will conduct interviews.

```sql
CREATE TABLE ocs (
  id STRING PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT,
  availability JSON,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Example Record:**
```json
{
  "id": "oc001",
  "name": "Akash Palanisamy",
  "email": "akash@iitb.ac.in",
  "department": "Energy Science and Engineering",
  "availability": {
    "monday": ["9:30AM-10:30AM", "10:30AM-11:30AM", "2PM-3:30PM", "3:30PM-5PM"],
    "tuesday": ["9:30AM-10:30AM", "10:30AM-11:30AM", "11:30AM-12:30PM", "2PM-3:30PM"],
    "wednesday": ["9:30AM-10:30AM", "2PM-3:30PM", "3:30PM-5PM"],
    "thursday": ["10:30AM-11:30AM", "11:30AM-12:30PM", "2PM-3:30PM"],
    "friday": ["9:30AM-10:30AM", "10:30AM-11:30AM", "2PM-3:30PM", "3:30PM-5PM"]
  },
  "createdAt": "2025-02-19T00:00:00Z"
}
```

**Data Source:** Hardcoded in `prisma/seed.js` (can be modified)

---

### 3. **Interviews Table** ⭐

Stores all scheduled interviews. **This table is populated AFTER running the scheduling algorithm.**

```sql
CREATE TABLE interviews (
  id STRING PRIMARY KEY,
  candidateId STRING UNIQUE NOT NULL REFERENCES candidates(id),
  oc1Id STRING NOT NULL REFERENCES ocs(id),
  oc2Id STRING NOT NULL REFERENCES ocs(id),
  scheduledAt TIMESTAMP NOT NULL,
  dayNumber INT NOT NULL,
  duration INT DEFAULT 60,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP ON UPDATE NOW()
);
```

**Example Record:**
```json
{
  "id": "int001",
  "candidateId": "clu123abc456",
  "oc1Id": "oc001",
  "oc2Id": "oc002",
  "scheduledAt": "2025-03-03T09:30:00Z",
  "dayNumber": 1,
  "duration": 60,
  "status": "scheduled",
  "notes": null,
  "createdAt": "2025-02-27T10:45:22Z",
  "updatedAt": "2025-02-27T10:45:22Z"
}
```

---

## Data Flow: From CSV to Scheduled Interviews

### **Step 1: Data Seeding** 
**File:** `prisma/seed.js`

1. **Parse CSV** - Read candidate responses from:
   ```
   Application Form- ISMP Mentors 2025-26 (Responses).csv
   ```

2. **Extract Fields:**
   - Personal info (name, email, roll number)
   - Department and year
   - Weekly availability (parsed from CSV columns)
   - Comments about unavailable dates

3. **Insert into Database:**
   ```javascript
   await prisma.candidate.upsert({
     where: { rollNumber },
     update: {...},
     create: {...}
   });
   ```

4. **OCs Already in DB** - Hardcoded OCs inserted:
   ```javascript
   await prisma.oC.upsert({
     where: { email },
     update: oc,
     create: oc
   });
   ```

**Result:** `candidates` table has 350+ records, `ocs` table has 2 records

---

### **Step 2: Running the Scheduling Algorithm**
**API Endpoint:** `POST /api/schedule`
**Algorithm File:** `lib/scheduler.js`

#### **Algorithm Process:**

1. **Score Candidates** - Calculate availability score
   ```javascript
   // Count common slots with both OCs
   const score = candidate.availability[day].filter(
     slot => oc1.availability[day].includes(slot) &&
             oc2.availability[day].includes(slot)
   ).length
   ```

2. **Sort by Constraint** - Candidates with fewer slots first
   ```javascript
   scoredCandidates.sort((a, b) => 
     a.availabilityScore - b.availabilityScore
   );
   ```

3. **Greedy Scheduling** - For each candidate:
   ```javascript
   for (let day = 1; day <= maxDays; day++) {
     const slots = findAvailableSlotsForDay(
       candidate, oc1, oc2, bookedSlots, day
     );
     
     if (slots.length > 0) {
       // Book earliest slot on this day
       bookSlot(candidate, slots[0]);
       break;
     }
   }
   ```

4. **Track Booked Slots** - Prevent double-booking
   ```javascript
   const bookedSlots = new Set();
   // Key format: "day1-9:30AM-10:30AM"
   ```

#### **Output:**
- `scheduledInterviews[]` - Array of booked interviews
- `unscheduledCandidates[]` - Candidates with no common slots

---

### **Step 3: Bulk Insert to Database**
**Location:** `pages/api/schedule.jsx`

```javascript
// Delete all existing interviews
await prisma.interview.deleteMany({});

// Bulk insert new schedule
if (stats.scheduledInterviews.length > 0) {
  await prisma.interview.createMany({
    data: stats.scheduledInterviews
  });
}
```

**What Gets Stored for Each Interview:**

| Field | Value | Source |
|-------|-------|--------|
| `id` | Auto-generated UUID | Prisma |
| `candidateId` | Candidate's ID | Scheduler |
| `oc1Id` | First OC's ID | Scheduler |
| `oc2Id` | Second OC's ID | Scheduler |
| `scheduledAt` | DateTime of interview | Calculated from day + time slot |
| `dayNumber` | 1-50+ | Calculated by scheduler |
| `duration` | 60 (minutes) | Hardcoded |
| `status` | "scheduled" | Default |
| `notes` | null | User can update |
| `createdAt` | Current timestamp | Prisma auto |

---

## Example: Database State After Scheduling

### **Before Scheduling:**
```
candidates:    350 records
ocs:           2 records
interviews:    0 records
```

### **After Scheduling (Example):**
```
candidates:    350 records (unchanged)
ocs:           2 records (unchanged)
interviews:    340 records
               ├─ 340 scheduled interviews
               └─ 10 candidates had 0 common slots (unscheduled)
```

### **Interview Distribution:**
```
Day 1 (Monday, Mar 3):    8 interviews
Day 2 (Tuesday, Mar 4):   10 interviews
Day 3 (Wednesday, Mar 5): 9 interviews
Day 4 (Thursday, Mar 6):  8 interviews
Day 5 (Friday, Mar 7):    7 interviews
Day 6 (Monday, Mar 10):   10 interviews
...
Day 48 (Friday, May 2):   3 interviews
```

---

## Query Examples

### **1. Get All Scheduled Interviews**
```javascript
const interviews = await prisma.interview.findMany({
  include: {
    candidate: { select: { name: true, rollNumber: true } },
    oc1: { select: { name: true } },
    oc2: { select: { name: true } }
  },
  orderBy: { scheduledAt: 'asc' }
});
```

### **2. Get Interviews for a Specific Day**
```javascript
const dayInterviews = await prisma.interview.findMany({
  where: { dayNumber: 3 },
  include: { candidate: true, oc1: true, oc2: true }
});
```

### **3. Get Interviews for a Specific OC**
```javascript
const ocInterviews = await prisma.interview.findMany({
  where: {
    OR: [
      { oc1Id: ocId },
      { oc2Id: ocId }
    ]
  }
});
```

### **4. Get Unscheduled Candidates**
```javascript
const scheduled = await prisma.interview.findMany({
  select: { candidateId: true }
});

const scheduledIds = new Set(scheduled.map(i => i.candidateId));

const unscheduled = await prisma.candidate.findMany({
  where: {
    id: { notIn: Array.from(scheduledIds) }
  }
});
```

### **5. Get Interview Count by Day**
```javascript
const stats = await prisma.interview.groupBy({
  by: ['dayNumber'],
  _count: {
    id: true
  },
  orderBy: { dayNumber: 'asc' }
});
```

---

## Updating After Scheduling

### **Mark Interview as Completed**
```javascript
await prisma.interview.update({
  where: { id: interviewId },
  data: { 
    status: 'completed',
    updatedAt: new Date()
  }
});
```

### **Cancel Interview**
```javascript
await prisma.interview.update({
  where: { id: interviewId },
  data: { 
    status: 'cancelled',
    updatedAt: new Date()
  }
});
```

### **Add Notes to Interview**
```javascript
await prisma.interview.update({
  where: { id: interviewId },
  data: { 
    notes: 'Candidate was very good fit',
    updatedAt: new Date()
  }
});
```

---

## Database Constraints & Relationships

```
┌──────────────────┐
│   Candidates     │
├──────────────────┤
│ id (PK)          │
│ name             │
│ email            │
│ rollNumber (UQ)  │◄──────┐
│ availability     │       │
└──────────────────┘       │
                           │
                        ┌──────────────────┐
                        │   Interviews     │
                        ├──────────────────┤
                        │ id (PK)          │
                        │ candidateId (FK) ├──────┐
                        │ oc1Id (FK)       │◄─────┤─────┐
                        │ oc2Id (FK)       │◄──┐  │     │
                        │ scheduledAt      │   │  │     │
                        │ dayNumber        │   │  │     │
                        │ duration         │   │  │     │
                        │ status           │   │  │     │
                        └──────────────────┘   │  │     │
                                               │  │     │
                        ┌──────────────────┐   │  │     │
                        │     OCs          │   │  │     │
                        ├──────────────────┤   │  │     │
                        │ id (PK)          ├───┴──┴─────┤
                        │ name             │
                        │ email (UQ)       │
                        │ availability     │
                        └──────────────────┘
```

### **Key Constraints:**
- `candidates.rollNumber` - UNIQUE (no duplicate candidates)
- `interviews.candidateId` - UNIQUE (one interview per candidate)
- `ocs.email` - UNIQUE (no duplicate OCs)
- `interviews.candidateId` - FOREIGN KEY to `candidates.id`
- `interviews.oc1Id` - FOREIGN KEY to `ocs.id`
- `interviews.oc2Id` - FOREIGN KEY to `ocs.id`

---

## Persistence & Storage

### **PostgreSQL Storage:**
- **Location:** Local PostgreSQL server (configured in `.env`)
- **Connection:** `postgresql://user:password@localhost:5432/interview_scheduler`
- **Persistence:** Data persists across server restarts
- **Backup:** Manual SQL export or `pg_dump`

### **Data Integrity:**
- All timestamps in UTC
- Foreign key constraints prevent orphaned records
- Unique constraints prevent duplicates
- Automatic `createdAt` and `updatedAt` timestamps

---

## Troubleshooting

### **Problem: "Too many unscheduled candidates"**
- **Cause:** Limited OC availability or candidate slots
- **Check:** 
  ```javascript
  // Count candidates with 0 common slots
  const hopeless = candidates.filter(c => 
    calculateAvailabilityScore(c, oc1, oc2) === 0
  );
  ```

### **Problem: "Interviews not saving to database"**
- **Check:** Database connection in `.env`
- **Verify:** `npx prisma db push` succeeds
- **Debug:** Check `scheduledInterviews` array is not empty

### **Problem: "Duplicate interview bookings"**
- **Cause:** Algorithm not properly tracking `bookedSlots`
- **Check:** `bookedSlots` Set is being updated correctly
- **Verify:** `findAvailableSlotsForDay()` filters booked slots

---

## Summary

The database follows a clean **relational model** with:
1. **Candidates** - 350+ records from CSV
2. **OCs** - 2 hardcoded records
3. **Interviews** - Generated by scheduler, ~340+ records
4. **Constraints** - Ensure data integrity

After scheduling runs, the interviews table is **completely replaced** with a fresh schedule based on the current candidate and OC availability.
