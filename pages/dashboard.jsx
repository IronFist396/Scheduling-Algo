import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export default function Dashboard() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/today-interviews');
      const data = await res.json();
      setInterviews(data);
    } catch (error) {
      showToast('Failed to fetch interviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, interviewId) => {
    setActionLoading(interviewId);
    try {
      const res = await fetch('/api/interview-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, interviewId }),
      });
      const result = await res.json();

      if (result.success) {
        showToast(result.message, 'success');
        fetchInterviews(); // Refresh the list
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      showToast('Failed to perform action', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED_BY_CANDIDATE':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED_BY_INTERVIEWER':
        return 'bg-red-100 text-red-800';
      case 'NO_SHOW':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'SCHEDULED':
        return 'Scheduled';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED_BY_CANDIDATE':
        return 'Cancelled (Candidate)';
      case 'CANCELLED_BY_INTERVIEWER':
        return 'Cancelled (Interviewer)';
      case 'NO_SHOW':
        return 'No Show';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading today's schedule...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Today's Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div
            className={`rounded-lg shadow-lg px-6 py-4 ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {interviews.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No interviews scheduled for today</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {interviews.map((interview) => (
              <div
                key={interview.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                {/* Time */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {format(new Date(interview.startTime), 'h:mm a')}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                      interview.status
                    )}`}
                  >
                    {getStatusLabel(interview.status)}
                  </span>
                </div>

                {/* Candidate Info */}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {interview.candidate.name}
                  </h3>
                  <p className="text-sm text-gray-600">{interview.candidate.department}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Roll: {interview.candidate.rollNumber}
                  </p>
                </div>

                {/* Interviewers */}
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Interviewers:</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
                      {interview.oc1.name}
                    </span>
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
                      {interview.oc2.name}
                    </span>
                  </div>
                </div>

                {/* Action Buttons - Only show if SCHEDULED */}
                {interview.status === 'SCHEDULED' && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleAction('complete', interview.id)}
                      disabled={actionLoading === interview.id}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === interview.id ? 'Processing...' : '✅ Complete'}
                    </button>
                    <button
                      onClick={() => handleAction('candidate_unavailable', interview.id)}
                      disabled={actionLoading === interview.id}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === interview.id ? 'Processing...' : '🔄 Candidate Unavailable'}
                    </button>
                    <button
                      onClick={() => handleAction('interviewer_unavailable', interview.id)}
                      disabled={actionLoading === interview.id}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === interview.id ? 'Processing...' : '⚠️ Interviewer Unavailable'}
                    </button>
                  </div>
                )}

                {/* Show candidate status for non-scheduled */}
                {interview.status !== 'SCHEDULED' && (
                  <div className="text-sm text-gray-500">
                    Candidate Status: {interview.candidate.status}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
