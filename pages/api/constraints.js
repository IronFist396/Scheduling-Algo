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
      .filter(c => Array.isArray(c.blockedDates) && c.blockedDates.length > 0)
      .map(c => {
        const interview = c.interviews[0] ?? null;
        let scheduledDate = null;
        let isViolation = false;

        if (interview && scheduleStart) {
          const d = new Date(scheduleStart);
          d.setUTCDate(d.getUTCDate() + (interview.dayNumber - 1));
          scheduledDate = d.toISOString().slice(0, 10);
          isViolation = c.blockedDates.includes(scheduledDate);
        }

        return {
          id: c.id,
          name: c.name,
          rollNumber: c.rollNumber,
          department: c.department,
          year: c.year,
          status: c.status,
          blockedDates: c.blockedDates,
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
      });

    return res.status(200).json({ candidates: result });
  } catch (error) {
    console.error('Error fetching constraints:', error);
    return res.status(500).json({ error: error.message });
  }
}
