import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const scheduleStart = process.env.SCHEDULE_START_DATE;

    // Fetch all candidates that have at least one blocked date
    const candidates = await prisma.candidate.findMany({
      select: {
        id: true,
        name: true,
        rollNumber: true,
        department: true,
        year: true,
        blockedDates: true,
        status: true,
        interviews: {
          select: {
            dayNumber: true,
            startTime: true,
          },
          take: 1,
        },
      },
    });

    // Compute the ISO scheduled date for each candidate (if scheduled)
    const result = candidates
      .map(c => {
        // Only keep blocked dates on or after the schedule start — earlier dates
        // are irrelevant because the scheduler never places anyone before startDate.
        const relevantBlockedDates = Array.isArray(c.blockedDates)
          ? c.blockedDates.filter(d => !scheduleStart || d >= scheduleStart)
          : [];

        if (relevantBlockedDates.length === 0) return null; // exclude if no relevant constraints

        const interview = c.interviews[0] ?? null;
        let scheduledDate = null;
        let isViolation = false;

        if (interview && scheduleStart) {
          const d = new Date(scheduleStart);
          d.setUTCDate(d.getUTCDate() + (interview.dayNumber - 1));
          scheduledDate = d.toISOString().slice(0, 10);
          isViolation = relevantBlockedDates.includes(scheduledDate);
        }

        return {
          id: c.id,
          name: c.name,
          rollNumber: c.rollNumber,
          department: c.department,
          year: c.year,
          status: c.status,
          blockedDates: relevantBlockedDates,
          scheduledDate,
          startTime: interview?.startTime
            ? new Date(interview.startTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata',
              })
            : null,
          isViolation,
        };
      })
      .filter(Boolean); // remove candidates with no relevant constraints

    return res.status(200).json({ candidates: result });
  } catch (error) {
    console.error('Error fetching constraints:', error);
    return res.status(500).json({ error: error.message });
  }
}
