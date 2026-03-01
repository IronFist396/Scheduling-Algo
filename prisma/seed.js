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
};

// Day mapping — CSV uses \r\n (Windows line endings) in headers
const DAY_COLUMNS = {
  monday: 'Monday\r\nMark the slots in which you DO NOT have academic commitments.',
  tuesday: 'Tuesday\r\nMark the slots in which you DO NOT have academic commitments.',
  wednesday: 'Wednesday\r\nMark the slots in which you DO NOT have academic commitments.',
  thursday: 'Thursday\r\nMark the slots in which you DO NOT have academic commitments.',
  friday: 'Friday\r\nMark the slots in which you DO NOT have academic commitments.',
};

function parseAvailability(row) {
  const availability = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  };

  Object.entries(DAY_COLUMNS).forEach(([day, columnName]) => {
    const slotsString = row[columnName] || '';
    if (slotsString) {
      // Split by comma and trim
      const slots = slotsString.split(',').map(s => s.trim()).filter(s => s);
      availability[day] = slots;
    }
  });

  return availability;
}

async function seedOCs() {
  console.log('🔧 Seeding OCs...');
  
  // Dummy OC data - you can modify this
  const ocs = [
    {
      name: 'Amritansh Joshi',
      email: 'amritansh@iitb.ac.in',
      department: 'Metallurgical Engineering and Materials Science',
      availability: {
        monday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
        tuesday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
        wednesday: ['11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
        thursday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
        friday: ['11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
      },
    },
    {
      name: 'Sara Atnoorkar',
      email: 'sara@iitb.ac.in',
      department: 'Energy Science and Engineering',
      availability: {
        monday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '7PM-8:30PM'],
        tuesday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
        wednesday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
        thursday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '7PM-8:30PM'],
        friday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '12:30PM-2PM', '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
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
          comments: row['Comments\nIf you are not available on any particular day during the month of March or April, please mention here with the specified format : date, reason. \nExample - April 12-15, travelling to home'],
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
          comments: row['Comments\nIf you are not available on any particular day during the month of March or April, please mention here with the specified format : date, reason. \nExample - April 12-15, travelling to home'],
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
      name: 'Rohan Mehta',
      email: 'rohan.mehta@iitb.ac.in',
      department: 'Computer Science and Engineering',
      availability: {
        monday: ['9:30AM-10:30AM', '11:30AM-12:30PM', '2PM-3:30PM', '5:30PM-7PM', '7PM-8:30PM'],
        tuesday: ['10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM', '3:30PM-5PM', '7PM-8:30PM'],
        wednesday: ['9:30AM-10:30AM', '12:30PM-2PM', '2PM-3:30PM', '5:30PM-7PM', '7PM-8:30PM'],
        thursday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '2PM-3:30PM', '3:30PM-5PM', '7PM-8:30PM'],
        friday: ['11:30AM-12:30PM', '12:30PM-2PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
      },
    },
    {
      name: 'Priya Nair',
      email: 'priya.nair@iitb.ac.in',
      department: 'Electrical Engineering',
      availability: {
        monday: ['10:30AM-11:30AM', '12:30PM-2PM', '3:30PM-5PM', '5:30PM-7PM'],
        tuesday: ['9:30AM-10:30AM', '11:30AM-12:30PM', '2PM-3:30PM', '5:30PM-7PM', '7PM-8:30PM'],
        wednesday: ['10:30AM-11:30AM', '11:30AM-12:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM'],
        thursday: ['9:30AM-10:30AM', '12:30PM-2PM', '2PM-3:30PM', '5:30PM-7PM', '7PM-8:30PM'],
        friday: ['9:30AM-10:30AM', '10:30AM-11:30AM', '2PM-3:30PM', '3:30PM-5PM', '7PM-8:30PM'],
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
