import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export default function TodayInterviews() {
  const [todayInterviews, setTodayInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchTodayInterviews();
  }, []);

  async function fetchTodayInterviews() {
    setLoading(true);
    try {
      const res = await fetch('/api/today-interviews');
      const data = await res.json();
      setTodayInterviews(data.interviews || []);
    } catch (error) {
      console.error('Error fetching today\'s interviews:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsComplete(interviewId) {
    try {
      const res = await fetch('/api/interview-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', interviewId }),
      });
      const result = await res.json();
      if (result.success) {
        fetchTodayInterviews(); // Refresh the list
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error marking as complete:', error);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="text-gray-600 text-sm">Loading today's interviews...</div>
      </div>
    );
  }

  const pendingInterviews = todayInterviews.filter(i => !i.isCompleted && i.status !== 'COMPLETED');
  const completedInterviews = todayInterviews.filter(i => i.isCompleted || i.status === 'COMPLETED');

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-sm border border-blue-200 overflow-hidden mb-6">
      {/* Header */}
      <div 
        className="bg-white bg-opacity-80 backdrop-blur px-6 py-4 cursor-pointer border-b border-blue-200"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📋</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Today's Interviews</h3>
              <p className="text-sm text-gray-600">
                {pendingInterviews.length} pending • {completedInterviews.length} completed
              </p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            {expanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-6">
          {todayInterviews.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-5xl mb-3 block">🎉</span>
              <p className="text-gray-600 font-medium">No interviews scheduled for today!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingInterviews.map((interview) => (
                <div
                  key={interview.id}
                  className="bg-white rounded-lg p-4 shadow-sm border border-blue-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-blue-600">
                          {format(new Date(interview.startTime), 'h:mm a')}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                          UPCOMING
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-gray-900">{interview.candidate.name}</p>
                        <p className="text-sm text-gray-600">
                          {interview.candidate.department} • Year {interview.candidate.year}
                        </p>
                        <p className="text-xs text-gray-500">
                          Interviewers: {interview.oc1.name} & {interview.oc2.name}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => markAsComplete(interview.id)}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium ml-4"
                    >
                      ✓ Complete
                    </button>
                  </div>
                </div>
              ))}

              {completedInterviews.length > 0 && (
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Completed Today</p>
                  {completedInterviews.map((interview) => (
                    <div
                      key={interview.id}
                      className="bg-green-50 rounded-lg p-3 mb-2 border border-green-200 opacity-75"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg text-green-600">✓</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{interview.candidate.name}</p>
                          <p className="text-xs text-gray-600">
                            {format(new Date(interview.startTime), 'h:mm a')} • Completed
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
