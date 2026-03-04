import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const PAGE_SIZE = 20;

export default function ConstraintsPage() {
  const [allCandidates, setAllCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter / search / pagination state
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'violation' | 'safe' | 'unscheduled'
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch('/api/constraints')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setAllCandidates(data.candidates);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Reset to page 1 whenever filter or search changes
  useEffect(() => { setPage(1); }, [filter, search]);

  const filtered = useMemo(() => {
    let list = allCandidates;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.rollNumber.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q)
      );
    }

    // Tab filter
    if (filter === 'violation') list = list.filter(c => c.isViolation);
    else if (filter === 'safe') list = list.filter(c => !c.isViolation && c.scheduledDate !== null);
    else if (filter === 'unscheduled') list = list.filter(c => c.scheduledDate === null);

    return list;
  }, [allCandidates, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Counts for filter tabs
  const counts = useMemo(() => ({
    all: allCandidates.length,
    violation: allCandidates.filter(c => c.isViolation).length,
    safe: allCandidates.filter(c => !c.isViolation && c.scheduledDate !== null).length,
    unscheduled: allCandidates.filter(c => c.scheduledDate === null).length,
  }), [allCandidates]);

  const TAB_CFG = [
    { key: 'all',         label: 'All',          color: 'bg-gray-100 text-gray-700 border-gray-300' },
    { key: 'violation',   label: '⚠ Violations',  color: 'bg-red-100 text-red-700 border-red-300' },
    { key: 'safe',        label: '✓ Safe',        color: 'bg-green-100 text-green-700 border-green-300' },
    { key: 'unscheduled', label: 'Not Scheduled', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading constraints…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#142749] shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="px-4 py-2 bg-[#1e3a6e] text-white rounded-lg hover:bg-[#162d55] transition-colors text-sm"
            >
              ← Back to Home
            </Link>
            <h1 className="text-xl font-bold text-white">Candidate Constraints</h1>
            <span className="ml-auto text-sm text-blue-200">
              {counts.all} candidate{counts.all !== 1 ? 's' : ''} with blocked dates
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search + Filter row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, roll number, or department…"
              className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {TAB_CFG.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                  filter === tab.key
                    ? tab.color + ' ring-2 ring-offset-1 ring-blue-400'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 bg-white bg-opacity-60 rounded-full px-1.5 py-0.5 text-xs">
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300"></span>
            Scheduled date is NOT in blocked dates (safe)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300"></span>
            Scheduled date IS a blocked date (violation!)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-orange-50 border border-orange-200"></span>
            Not yet scheduled
          </span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
            No candidates match this filter.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-6">#</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Candidate</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Roll No</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dept / Year</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Blocked Dates</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Scheduled Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time (IST)</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((c, idx) => {
                  const rowBg = c.isViolation
                    ? 'bg-red-50 hover:bg-red-100'
                    : c.scheduledDate === null
                    ? 'bg-orange-50 hover:bg-orange-100'
                    : 'bg-green-50 hover:bg-green-100';

                  const scheduledDateBadge = c.scheduledDate === null
                    ? <span className="text-gray-400 italic">Not scheduled</span>
                    : c.isViolation
                    ? <span className="font-mono bg-red-200 text-red-800 px-2 py-0.5 rounded font-semibold">{c.scheduledDate}</span>
                    : <span className="font-mono bg-green-200 text-green-800 px-2 py-0.5 rounded font-semibold">{c.scheduledDate}</span>;

                  return (
                    <tr key={c.id} className={`transition-colors ${rowBg}`}>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {c.isViolation && (
                          <span className="inline-block mr-1.5 text-red-500 text-xs" title="Constraint violation">⚠</span>
                        )}
                        {c.name}
                      </td>
                      <td className="px-5 py-3 text-gray-600 font-mono text-xs">{c.rollNumber}</td>
                      <td className="px-5 py-3 text-gray-600">
                        {c.department}
                        <span className="ml-1 text-gray-400 text-xs">· Yr {c.year}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.blockedDates.map(d => (
                            <span
                              key={d}
                              className={`font-mono px-2 py-0.5 rounded text-xs ${
                                d === c.scheduledDate
                                  ? 'bg-red-200 text-red-800 font-bold ring-1 ring-red-400'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">{scheduledDateBadge}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {c.startTime ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          c.status === 'SCHEDULED'  ? 'bg-blue-100 text-blue-700' :
                          c.status === 'COMPLETED'  ? 'bg-purple-100 text-purple-700' :
                          c.status === 'PENDING'    ? 'bg-yellow-100 text-yellow-700' :
                                                      'bg-gray-100 text-gray-500'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-xs text-gray-500">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100"
                >
                  «
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100"
                >
                  ‹
                </button>

                {/* Page number buttons — show up to 5 around current */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-2 py-1 text-xs text-gray-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                          p === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100"
                >
                  ›
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
