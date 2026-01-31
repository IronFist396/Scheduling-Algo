import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, COMPLETE, RESCHEDULE

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch('/api/action-history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUndo(actionId) {
    if (!confirm('Are you sure you want to undo this action?')) {
      return;
    }

    try {
      const res = await fetch('/api/action-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo', actionId }),
      });

      const result = await res.json();
      if (result.success) {
        alert('Action undone successfully!');
        fetchHistory();
      } else {
        alert('Error undoing action: ' + result.message);
      }
    } catch (error) {
      console.error('Error undoing action:', error);
      alert('Failed to undo action');
    }
  }

  const filteredHistory = history.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'COMPLETE') return item.actionType === 'COMPLETE';
    if (filter === 'RESCHEDULE') return item.actionType === 'RESCHEDULE';
    return true;
  });

  const getActionIcon = (type) => {
    if (type === 'COMPLETE') return '✅';
    if (type === 'RESCHEDULE') return '🔄';
    return '📝';
  };

  const getActionColor = (type) => {
    if (type === 'COMPLETE') return 'bg-green-50 border-green-200 text-green-900';
    if (type === 'RESCHEDULE') return 'bg-blue-50 border-blue-200 text-blue-900';
    return 'bg-gray-50 border-gray-200 text-gray-900';
  };

  const getActionLabel = (type) => {
    if (type === 'COMPLETE') return 'Marked Complete';
    if (type === 'RESCHEDULE') return 'Rescheduled';
    return 'Unknown Action';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Back to Home
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Action History</h1>
            <span className="ml-auto text-lg font-semibold text-gray-600">
              {filteredHistory.length} {filteredHistory.length === 1 ? 'action' : 'actions'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Actions
              </button>
              <button
                onClick={() => setFilter('COMPLETE')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'COMPLETE'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ✅ Completed
              </button>
              <button
                onClick={() => setFilter('RESCHEDULE')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'RESCHEDULE'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🔄 Rescheduled
              </button>
            </div>
          </div>
        </div>

        {/* History Timeline */}
        {filteredHistory.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <span className="text-6xl mb-4 block">📋</span>
            <p className="text-gray-500 text-lg">No actions found</p>
            <p className="text-gray-400 text-sm mt-2">
              Actions like marking interviews complete or rescheduling will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow ${getActionColor(
                  item.actionType
                )}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className="text-4xl">{getActionIcon(item.actionType)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{getActionLabel(item.actionType)}</h3>
                        <span className="text-xs font-semibold px-2 py-1 bg-white rounded">
                          {item.actionType}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-700">Candidate:</span>
                          <span className="text-gray-900 font-semibold">
                            {item.candidateName}
                          </span>
                        </div>

                        {item.details && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Details:</span> {item.details}
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                          <span>
                            🕐 {format(new Date(item.timestamp), 'MMM d, yyyy - h:mm a')}
                          </span>
                          {item.performedBy && (
                            <span>👤 Performed by: {item.performedBy}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Undo Button */}
                  {!item.undone && (
                    <button
                      onClick={() => handleUndo(item.id)}
                      className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-400 font-semibold text-sm transition-colors ml-4"
                      title="Undo this action"
                    >
                      ↶ Undo
                    </button>
                  )}

                  {item.undone && (
                    <div className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium ml-4">
                      Undone
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
