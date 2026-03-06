// pages/api/weekend-overrides.js
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';
import { applyWeekendOverride } from '../../lib/rescheduleLogic';

const ALL_SLOTS = [
  '9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM',
  '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM',
  '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM',
];

function slotIndex(slot) {
  return ALL_SLOTS.indexOf(slot);
}

export { ALL_SLOTS, slotIndex };

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  // GET: fetch all weekend overrides
  if (req.method === 'GET') {
    try {
      const overrides = await prisma.weekendOverride.findMany({
        orderBy: { date: 'asc' },
      });
      return res.status(200).json({ overrides });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST: save (create/update) an override
  if (req.method === 'POST') {
    const { date, startSlot, endSlot, note } = req.body;

    if (!date || !startSlot || !endSlot) {
      return res.status(400).json({ error: 'date, startSlot and endSlot are required' });
    }
    const d = new Date(date);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      return res.status(400).json({ error: 'Overrides can only be set for Saturdays and Sundays' });
    }
    if (slotIndex(startSlot) === -1 || slotIndex(endSlot) === -1) {
      return res.status(400).json({ error: 'Invalid slot value' });
    }
    if (slotIndex(startSlot) > slotIndex(endSlot)) {
      return res.status(400).json({ error: 'startSlot must come before endSlot' });
    }

    try {
      const override = await prisma.weekendOverride.upsert({
        where: { date },
        update: { startSlot, endSlot, note: note || null },
        create: { date, startSlot, endSlot, note: note || null },
      });
      return res.status(200).json({ success: true, override });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // PUT: apply a saved override — move trimmed interviews to end of schedule
  if (req.method === 'PUT') {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    try {
      const override = await prisma.weekendOverride.findUnique({ where: { date } });
      if (!override) {
        return res.status(404).json({ error: 'No override saved for this date. Save it first.' });
      }

      const result = await applyWeekendOverride(date, override.startSlot, override.endSlot);
      return res.status(200).json(result);
    } catch (error) {
      console.error('[Apply Override]', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // DELETE: remove an override (does NOT un-apply it)
  if (req.method === 'DELETE') {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    try {
      await prisma.weekendOverride.deleteMany({ where: { date } });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
