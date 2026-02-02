import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const today = new Date();
  
  // Create start and end of day in UTC for today's date
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, '0');
  const day = String(today.getUTCDate()).padStart(2, '0');
  
  const dayStart = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const dayEnd = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

  const interviews = await prisma.interview.findMany({
    where: {
      startTime: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    take: 5,
    select: {
      id: true,
      startTime: true,
      status: true,
    }
  });

  return res.json({
    todayUTC: `${year}-${month}-${day}`,
    queryingFrom: dayStart.toISOString(),
    queryingTo: dayEnd.toISOString(),
    interviewsFound: interviews.length,
    interviews: interviews,
  });
}
