/**
 * API Endpoint: Algorithm Comparison
 * Compares different scheduling algorithms and returns results
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { compareAlgorithms, compareAlgorithmsMultiRun } = require('../../lib/compareAlgorithms');
const { requireAuth } = require('../../lib/auth');

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('\n📊 Algorithm comparison requested...');

    const { multiRun = false, iterations = 5 } = req.body;

    // Fetch all data from database
    const candidates = await prisma.candidate.findMany();
    const ocs = await prisma.oC.findMany();

    if (candidates.length === 0) {
      return res.status(400).json({ error: 'No candidates found in database' });
    }

    if (ocs.length < 2) {
      return res.status(400).json({ error: 'At least 2 OCs required' });
    }

    const startDate = new Date('2026-03-02'); // March 2, 2026

    let comparisonResults;

    if (multiRun) {
      console.log(`Running multi-run comparison with ${iterations} iterations...`);
      comparisonResults = await compareAlgorithmsMultiRun(
        candidates,
        ocs,
        startDate,
        999,
        iterations
      );
    } else {
      console.log('Running single-run comparison...');
      comparisonResults = await compareAlgorithms(
        candidates,
        ocs,
        startDate,
        999
      );
    }

    return res.status(200).json({
      success: true,
      comparison: comparisonResults,
      totalCandidates: candidates.length,
      totalOCs: ocs.length,
    });

  } catch (error) {
    console.error('Algorithm comparison failed:', error);
    return res.status(500).json({ 
      error: 'Algorithm comparison failed',
      message: error.message 
    });
  }
}
