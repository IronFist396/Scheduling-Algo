import { prisma } from '../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stats = await prisma.$transaction([
      prisma.candidate.count(),
      prisma.interview.count(),
      prisma.interview.count({ where: { status: 'SCHEDULED' } }),
      prisma.interview.count({ where: { status: 'COMPLETED' } }),
      prisma.oC.findMany({
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
    ]);

    const [totalCandidates, totalInterviews, scheduled, completed, ocs] = stats;

    return res.status(200).json({
      totalCandidates,
      totalInterviews,
      scheduled,
      completed,
      unscheduled: totalCandidates - totalInterviews,
      ocs,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: error.message });
  }
}
