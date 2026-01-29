import { getTodayInterviews } from '../../lib/interviewActions';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const interviews = await getTodayInterviews();
    return res.status(200).json(interviews);
  } catch (error) {
    console.error('Error fetching today\'s interviews:', error);
    return res.status(500).json({ error: error.message });
  }
}
