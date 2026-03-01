const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

// Usage:
//  - Provide required fields via env or CLI args.
//    EMAIL and ROLL_NUMBER are required.
// Examples:
//  EMAIL=alice@example.com ROLL_NUMBER=CS2021001 node prisma/seedCandidate.js
//  node prisma/seedCandidate.js alice@example.com CS2021001 "Alice" CS 3

async function seedCandidate() {
  // Hardcoded candidate details
  const email = '23b0689@iitb.ac.in';
  const rollNumber = '23b0689';
  const name = 'Aryan Badkul';
  const department = 'Computer Science';
  const year = '3';
  const hostel = 'H4';
  const contactNumber = '9876543210';
  // All available slots for the candidate (common interview slots)
  const availability = {
    monday: ['09:30-10:30', '10:30-11:30', '11:30-12:30', '13:30-14:30', '14:30-15:30', '15:30-16:30'],
    tuesday: ['09:30-10:30', '10:30-11:30', '11:30-12:30', '13:30-14:30', '14:30-15:30', '15:30-16:30'],
    wednesday: ['09:30-10:30', '10:30-11:30', '11:30-12:30', '13:30-14:30', '14:30-15:30', '15:30-16:30'],
    thursday: ['09:30-10:30', '10:30-11:30', '11:30-12:30', '13:30-14:30', '14:30-15:30', '15:30-16:30'],
    friday: ['09:30-10:30', '10:30-11:30', '11:30-12:30', '13:30-14:30', '14:30-15:30', '15:30-16:30'],
  };
  const comments = 'Seeded candidate for testing';

  try {
    const candidate = await prisma.candidate.upsert({
      where: { rollNumber },
      update: {
        email,
        name,
        department,
        year,
        hostel,
        contactNumber,
        availability,
        comments,
      },
      create: {
        email,
        rollNumber,
        name,
        department,
        year,
        hostel,
        contactNumber,
        availability,
        comments,
      },
    });

    console.log('✅ Candidate seeded:', candidate.email, '(', candidate.rollNumber, ')');
  } catch (err) {
    console.error('Error seeding candidate:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedCandidate();
