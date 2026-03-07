import { useState, useEffect } from 'react';
import Link from 'next/link';
import { parseISO } from 'date-fns';

const ALL_SLOTS = [
  '9:30AM-10:30AM', '10:30AM-11:30AM', '11:30AM-12:30PM', '12:30PM-2PM',
  '2PM-3:30PM', '3:30PM-5PM', '5:30PM-7PM', '7PM-8:30PM',
  '9:30PM-10:30PM', '10:30PM-11:30PM', '11:30PM-12:30AM',
];

const DEFAULT_WEEKEND_START = '11:30AM-12:30PM';
const DEFAULT_WEEKEND_END   = '11:30PM-12:30AM';

function getDayLabel(isoDate) {
  const d = parseISO(isoDate);
  const day = d.getUTCDay();
  return day === 6 ? 'Saturday' : 'Sunday';
}

export default function WeekendOverridesPage() {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [date, setDate] = useState('');
  const [startSlot, setStartSlot] = useState(DEFAULT_WEEKEND_START);
  const [endSlot, setEndSlot] = useState(DEFAULT_WEEKEND_END);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => { fetchOverrides(); }, []);

  async function fetchOverrides() {
    setLoading(true);
    try {
      const res = await fetch('/api/weekend-overrides');
      const data = await res.json();
      setOverrides(data.overrides || []);
    } finally { setLoading(false); }
  }

  function validateDate(val) {
    if (!val) return 'Date is required';
    const d = new Date(val);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) return 'Only Saturdays and Sundays can have overrides';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateDate(date);
    if (err) { setFormError(err); return; }
    const startIdx = ALL_SLOTS.indexOf(startSlot);
    const endIdx   = ALL_SLOTS.indexOf(endSlot);
    if (startIdx > endIdx) { setFormError('Start slot must come before end slot'); return; }
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch('/api/weekend-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, startSlot, endSlot, note }),
      });
      const data = await res.json();
      if (!data.success) { setFormError(data.error || 'Save failed'); return; }
      setDate(''); setNote('');
      setStartSlot(DEFAULT_WEEKEND_START);
      setEndSlot(DEFAULT_WEEKEND_END);
      fetchOverrides();
    } finally { setSaving(false); }
  }

  async function handleApply(overrideDate) {
    if (!confirm('Apply override for ' + overrideDate + '? Interviews outside the new window will be moved to end of schedule.')) return;
    setApplyResult(null);
    setApplying(overrideDate);
    try {
      const res = await fetch('/api/weekend-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: overrideDate }),
      });
      const data = await res.json();
      setApplyResult({ date: overrideDate, result: data });
    } finally { setApplying(null); }
  }

  async function handleDelete(overrideDate) {
    if (!confirm('Remove override for ' + overrideDate + '? This does NOT undo already-applied moves.')) return;
    setDeleting(overrideDate);
    try {
      await fetch('/api/weekend-overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: overrideDate }),
      });
      fetchOverrides();
    } finally { setDeleting(null); }
  }

  const startIdx = ALL_SLOTS.indexOf(startSlot);
  const validEndSlots = ALL_SLOTS.slice(startIdx);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#142749] shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="px-4 py-2 bg-[#1e3a6e] text-white rounded-lg hover:bg-[#162d55] transition-colors text-sm">
              Back to Home
            </Link>
            <h1 className="text-2xl font-bold text-white">Weekend Time Overrides</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">How this works</p>
          <p>Default weekend window:{' '}<span className="font-mono font-semibold">{DEFAULT_WEEKEND_START}</span>{' to '}<span className="font-mono font-semibold">{DEFAULT_WEEKEND_END}</span>.</p>
          <p className="mt-1">1. <strong>Save</strong> an override for a specific Sat/Sun.<br />2. Click <strong>Apply</strong> to move trimmed interviews to the end of the schedule.</p>
        </div>

        {applyResult && (
          <div className={`rounded-lg border p-4 text-sm ${applyResult.result.success ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
            <p className="font-bold mb-2">{applyResult.result.success ? 'OK' : 'FAILED'} - Override applied for {applyResult.date}</p>
            <p className="mb-2">{applyResult.result.message}</p>
            {applyResult.result.details?.length > 0 && (
              <ul className="space-y-1 mt-2 border-t pt-2">
                {applyResult.result.details.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-medium">{d.candidateName}:</span>
                    {d.to ? <span className="text-green-700">{d.from} moved to {d.to}</span> : <span className="text-red-600">{d.from} - could not place: {d.error}</span>}
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setApplyResult(null)} className="mt-3 text-xs underline opacity-60">Dismiss</button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add / Update Override</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-gray-400">(must be Sat or Sun)</span></label>
                <input type="date" value={date} onChange={e => { setDate(e.target.value); setFormError(''); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Exam season - shorter day"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Slot</label>
                <select value={startSlot} onChange={e => { setStartSlot(e.target.value); if (ALL_SLOTS.indexOf(endSlot) < ALL_SLOTS.indexOf(e.target.value)) setEndSlot(e.target.value); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ALL_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Slot</label>
                <select value={endSlot} onChange={e => setEndSlot(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {validEndSlots.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>}
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm transition-colors">
              {saving ? 'Saving...' : 'Save Override'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Saved Overrides <span className="ml-2 text-sm font-normal text-gray-500">({overrides.length} configured)</span>
          </h2>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : overrides.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No overrides yet. All weekends use the default window.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overrides.map(o => {
                const dayLabel = getDayLabel(o.date);
                const isSat = dayLabel === 'Saturday';
                return (
                  <div key={o.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${isSat ? 'bg-purple-50 border-purple-200' : 'bg-orange-50 border-orange-200'}`}>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isSat ? 'bg-purple-200 text-purple-800' : 'bg-orange-200 text-orange-800'}`}>{dayLabel}</span>
                        <span className="font-semibold text-gray-900">{o.date}</span>
                      </div>
                      <p className="text-sm text-gray-600"><span className="font-medium">Window:</span>{' '}<span className="font-mono">{o.startSlot}</span>{' to '}<span className="font-mono">{o.endSlot}</span></p>
                      {o.note && <p className="text-xs text-gray-400 italic">{o.note}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApply(o.date)} disabled={applying === o.date}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50">
                        {applying === o.date ? 'Applying...' : 'Apply'}
                      </button>
                      <button onClick={() => handleDelete(o.date)} disabled={deleting === o.date}
                        className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium transition-colors disabled:opacity-50">
                        {deleting === o.date ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}