import {
  markInterviewComplete,
  rescheduleInterview,
} from '../../lib/interviewActions';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, interviewId, reason, lastAction } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  try {
    let result;

    switch (action) {
      case 'complete':
        if (!interviewId) {
          return res.status(400).json({ error: 'Missing interviewId' });
        }
        result = await markInterviewComplete(interviewId);
        
        // Save to action history
        if (result.success) {
          const interview = await prisma.interview.findUnique({
            where: { id: interviewId },
            include: { candidate: true },
          });
          
          await prisma.actionHistory.create({
            data: {
              actionType: 'COMPLETE',
              interviewId: interviewId,
              candidateName: interview.candidate.name,
              details: `Interview marked as completed`,
            },
          });
        }
        break;
        
      case 'reschedule':
        if (!interviewId) {
          return res.status(400).json({ error: 'Missing interviewId' });
        }
        result = await rescheduleInterview(interviewId, reason || 'Candidate unavailable');
        
        // Save to action history
        if (result.success) {
          const interview = await prisma.interview.findUnique({
            where: { id: interviewId },
            include: { candidate: true },
          });
          
          await prisma.actionHistory.create({
            data: {
              actionType: 'RESCHEDULE',
              interviewId: interviewId,
              candidateName: interview.candidate.name,
              details: `Reason: ${reason || 'Candidate unavailable'}. Method: ${result.method || 'Unknown'}`,
            },
          });
        }
        break;
        
      case 'undo':
        if (!lastAction) {
          return res.status(400).json({ error: 'Missing lastAction data' });
        }
        
        // Handle undo based on the previous action type
        if (lastAction.type === 'complete') {
          // Revert completion - mark as SCHEDULED again
          await prisma.interview.update({
            where: { id: lastAction.interviewId },
            data: {
              status: 'SCHEDULED',
              isCompleted: false,
            },
          });
          
          // Update candidate status
          const interview = await prisma.interview.findUnique({
            where: { id: lastAction.interviewId },
            include: { candidate: true },
          });
          
          await prisma.candidate.update({
            where: { id: interview.candidateId },
            data: { status: 'SCHEDULED' },
          });
          
          result = { success: true, message: 'Interview completion undone' };
        } else {
          result = { success: false, message: 'Undo not supported for this action type yet' };
        }
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error performing interview action:', error);
    return res.status(500).json({ error: error.message });
  }
}
