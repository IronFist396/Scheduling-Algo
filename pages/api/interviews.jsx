import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const { day, ocId, all } = req.query;

      let whereClause = {};
      
      // If 'all' parameter is present, fetch all interviews
      if (!all) {
        if (day) {
          whereClause.dayNumber = parseInt(day);
        }
        
        if (ocId) {
          whereClause.OR = [
            { oc1Id: ocId },
            { oc2Id: ocId },
          ];
        }
      }

      const interviews = await prisma.interview.findMany({
        where: whereClause,
        include: {
          candidate: {
            select: {
              name: true,
              rollNumber: true,
              department: true,
              email: true,
              contactNumber: true,
            },
          },
          oc1: {
            select: {
              name: true,
              email: true,
            },
          },
          oc2: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      console.log(`Found ${interviews.length} interviews for day=${day}, ocId=${ocId}`);
      if (interviews.length > 0) {
        console.log('First interview:', {
          name: interviews[0].candidate?.name,
          startTime: interviews[0].startTime,
          dayNumber: interviews[0].dayNumber
        });
      }

      return res.status(200).json({ interviews });
    } catch (error) {
      console.error('Error fetching interviews:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, status, notes, startTime } = req.body;

      const updateData = {};
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (startTime) updateData.startTime = new Date(startTime);

      const interview = await prisma.interview.update({
        where: { id },
        data: updateData,
      });

      return res.status(200).json({ interview });
    } catch (error) {
      console.error('Error updating interview:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      await prisma.interview.delete({
        where: { id },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting interview:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
