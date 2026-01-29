import {
  markInterviewComplete,
  rescheduleInterview,
} from '../../lib/interviewActions';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, interviewId, reason } = req.body;

  if (!action || !interviewId) {
    return res.status(400).json({ error: 'Missing action or interviewId' });
  }

  try {
    let result;

    switch (action) {
      case 'complete':
        result = await markInterviewComplete(interviewId);
        break;
      case 'reschedule':
        result = await rescheduleInterview(interviewId, reason || 'Candidate unavailable');
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
