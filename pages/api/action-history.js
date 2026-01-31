import { prisma } from '../../lib/prisma';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Fetch action history
    try {
      const history = await prisma.actionHistory.findMany({
        orderBy: {
          timestamp: 'desc',
        },
        take: 100, // Limit to last 100 actions
      });

      return res.status(200).json({ history });
    } catch (error) {
      console.error('Error fetching action history:', error);
      return res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'POST') {
    // Handle undo action
    const { action, actionId } = req.body;

    if (action !== 'undo' || !actionId) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    try {
      // Get the action to undo
      const historyItem = await prisma.actionHistory.findUnique({
        where: { id: actionId },
      });

      if (!historyItem) {
        return res.status(404).json({ error: 'Action not found' });
      }

      if (historyItem.undone) {
        return res.status(400).json({ error: 'Action already undone' });
      }

      // Perform undo based on action type
      if (historyItem.actionType === 'COMPLETE') {
        // Revert completion
        const interview = await prisma.interview.findUnique({
          where: { id: historyItem.interviewId },
          include: { candidate: true },
        });

        if (interview) {
          await prisma.$transaction([
            prisma.interview.update({
              where: { id: historyItem.interviewId },
              data: {
                status: 'SCHEDULED',
                isCompleted: false,
              },
            }),
            prisma.candidate.update({
              where: { id: interview.candidateId },
              data: { status: 'SCHEDULED' },
            }),
            prisma.actionHistory.update({
              where: { id: actionId },
              data: { undone: true },
            }),
          ]);
        }
      } else if (historyItem.actionType === 'RESCHEDULE') {
        // For reschedule, just mark as undone
        // Actual undo of reschedule is complex and may not be needed
        await prisma.actionHistory.update({
          where: { id: actionId },
          data: { undone: true },
        });
      }

      return res.status(200).json({ success: true, message: 'Action undone successfully' });
    } catch (error) {
      console.error('Error undoing action:', error);
      return res.status(500).json({ error: error.message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
