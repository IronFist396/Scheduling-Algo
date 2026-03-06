const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const prisma = new PrismaClient();

// Slot mapping from CSV column values
const SLOT_MAPPING = {
  '9:30AM-10:30AM': { start: '09:30', end: '10:30' },
  '10:30AM-11:30AM': { start: '10:30', end: '11:30' },
  '11:30AM-12:30PM': { start: '11:30', end: '12:30' },
  '12:30PM-2PM': { start: '12:30', end: '14:00' },
  '2PM-3:30PM': { start: '14:00', end: '15:30' },
  '3:30PM-5PM': { start: '15:30', end: '17:00' },
  '5:30PM-7PM': { start: '17:30', end: '19:00' },
  '7PM-8:30PM': { start: '19:00', end: '20:30' },
  '9:30PM-10:30PM': { start: '21:30', end: '22:30' },
  '10:30PM-11:30PM': { start: '22:30', end: '23:30' },
  '11:30PM-12:30AM': { start: '23:30', end: '00:30' },
};

// Day mapping — CSV uses \r\n (Windows line endings) in headers
const DAY_COLUMNS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
};

function parseAvailability(row) {
  const ALL_SLOTS = [
    '9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM',
    '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM',
    '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM',
  ];

  // Default weekend window: 11:30AM → 12:30AM (last slot)
  // Admins can override specific weekend dates via the Weekend Overrides UI
  const DEFAULT_WEEKEND_SLOTS = [
    '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM',
    '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM',
  ];

  const availability = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: DEFAULT_WEEKEND_SLOTS,
    sunday: DEFAULT_WEEKEND_SLOTS,
  };

  // Night slots not present in the CSV form — assumed free for everyone every day
  const NIGHT_SLOTS = ['9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'];

  Object.entries(DAY_COLUMNS).forEach(([day, columnName]) => {
    const slotsString = row[columnName] || '';
    if (slotsString) {
      // Split by comma and trim
      const slots = slotsString.split(',').map(s => s.trim()).filter(s => s);
      availability[day] = [...slots, ...NIGHT_SLOTS];
    } else {
      // No daytime availability selected, but night slots still apply
      availability[day] = [...NIGHT_SLOTS];
    }
  });

  return availability;
}

/**
 * Parse "dates not available" column (dd/MM/yyyy, comma-separated)
 * Returns an array of ISO date strings: ["2026-03-09", "2026-03-10", ...]
 * Dates before SCHEDULE_START_DATE are silently dropped — the scheduler
 * never assigns anyone to a day before the start, so they are meaningless.
 */
function parseBlockedDates(raw) {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return [];
  const scheduleStart = process.env.SCHEDULE_START_DATE || '1970-01-01';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(s => /\d{2}\/\d{2}\/\d{4}/.test(s))
    .map(s => {
      const [day, month, year] = s.split('/');
      return `${year}-${month}-${day}`; // dd/MM/yyyy → YYYY-MM-DD
    })
    .filter(iso => iso >= scheduleStart); // drop anything before schedule start
}

async function seedOCs() {
  console.log('🔧 Seeding OCs...');
  
  // Dummy OC data - you can modify this
  const ocs = [
    {
      name: 'Ojas Joshi',
      email: 'ojas@iitb.ac.in',
      department: 'Environmental Science and Engineering',
      availability: {
        monday: ['10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        tuesday: ['9:30AM-10:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        wednesday: ['9:30AM-10:30AM', '12:30PM-2PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        thursday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '12:30PM-2PM', '2PM-3:30PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        friday: ['9:30AM-10:30AM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        saturday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        sunday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
      },
    },
    {
      name: 'Dev Arora',
      email: 'dev@iitb.ac.in',
      department: 'Electrical Engineering',
      availability: {
        monday: ['9:30AM-10:30AM', '12:30PM-2PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        tuesday: ['10:30AM-11:30AM', '12:30PM-2PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        wednesday: ['11:30AM-12:30PM', '12:30PM-2PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        thursday: ['11:30AM-12:30PM', '12:30PM-2PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        friday: ['11:30AM-12:30PM', '12:30PM-2PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        saturday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        sunday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
      },
    },
  ];

  for (const oc of ocs) {
    await prisma.oC.upsert({
      where: { email: oc.email },
      update: oc,
      create: oc,
    });
  }

  console.log(`✅ Created ${ocs.length} OCs`);
}

async function seedCandidates() {
  console.log('📋 Seeding candidates from CSV...');
// Scheduling-Algo/data/Interview Scheduler - Sheet1.csv
  const csvPath = path.join(__dirname, '..', 'Interview Scheduler - Sheet1.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at: ${csvPath}`);
    console.log('Please ensure the CSV file is in the root directory');
    return;
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Found ${records.length} candidates in CSV`);

  let successCount = 0;
  let errorCount = 0;

  for (const [index, row] of records.entries()) {
    try {
      const rollNumber = row['roll number'];
      const firstName = row['first name'];
      const lastName = row['last name'];
      
      if (!rollNumber || !firstName) {
        console.warn(`⚠️  Skipping row ${index + 1}: Missing required fields`);
        errorCount++;
        continue;
      }

      const availability = parseAvailability(row);
      const blockedDates = parseBlockedDates(row['dates not available']);

      await prisma.candidate.upsert({
        where: { rollNumber },
        update: {
          name: `${firstName} ${lastName}`.trim(),
          email: row['email id'] || `${rollNumber}@iitb.ac.in`,
          department: row['department'] || 'Unknown',
          year: row['year of study'] || 'Unknown',
          hostel: row['hostel'],
          contactNumber: row['contact number'],
          availability,
          blockedDates,
          comments: row['Not available'],
        },
        create: {
          rollNumber,
          name: `${firstName} ${lastName}`.trim(),
          email: row['email id'] || `${rollNumber}@iitb.ac.in`,
          department: row['department'] || 'Unknown',
          year: row['year of study'] || 'Unknown',
          hostel: row['hostel'],
          contactNumber: row['contact number'],
          availability,
          blockedDates,
          comments: row['Not available'],
        },
      });

      successCount++;
      if (successCount % 50 === 0) {
        console.log(`✅ Processed ${successCount} candidates...`);
      }
    } catch (error) {
      console.error(`❌ Error processing row ${index + 1}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n✅ Successfully imported ${successCount} candidates`);
  if (errorCount > 0) {
    console.log(`⚠️  Failed to import ${errorCount} candidates`);
  }
}

async function seedReviewers() {
  console.log('🔍 Seeding Reviewers...');

  const reviewers = [
    {
      name: 'Diya Sharma',
      email: 'diya@iitb.ac.in',
      department: 'Mechanical Engineering',
      availability: {
        monday: ['10:30AM-11:30AM', '12:30PM-2PM', '3:30PM-5PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        tuesday: ['9:30AM-10:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        wednesday: ['9:30AM-10:30AM', '12:30PM-2PM', '2PM-3:30PM','3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        thursday: ['10:30AM-11:30AM', '12:30PM-2PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        friday: ['9:30AM-10:30AM', '12:30PM-2PM',  '2PM-3:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        saturday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        sunday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
      },
    },
    {
      name: 'Aagam Jain',
      email: 'aagam@iitb.ac.in',
      department: 'Mechanical Engineering',
      availability: {
        monday: ['9:30AM-10:30AM', '12:30PM-2PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        tuesday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '12:30PM-2PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        wednesday: ['12:30PM-2PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        thursday: ['10:30AM-11:30AM', '11:30PM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        friday: ['12:30PM-2PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        saturday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
        sunday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM', '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM'],
      },
    },
  ];

  for (const reviewer of reviewers) {
    await prisma.reviewer.upsert({
      where: { email: reviewer.email },
      update: reviewer,
      create: reviewer,
    });
  }

  console.log(`✅ Created ${reviewers.length} Reviewers`);
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await prisma.interview.deleteMany({});
    await prisma.candidate.deleteMany({});
    await prisma.reviewer.deleteMany({});
    await prisma.oC.deleteMany({});
    console.log('✅ Database cleaned\n');

    // Seed data
    await seedOCs();
    await seedReviewers();
    await seedCandidates();

    console.log('\n✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
