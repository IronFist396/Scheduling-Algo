import { useState, useEffect } from 'react';
import { format } from 'date-fns';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
  '9:30 AM',
  '10:30 AM',
  '11:30 AM',
  '12:30 PM',
  '2:00 PM',
  '3:30 PM',
  '5:30 PM',
  '7:00 PM',
];

// Helper function to normalize time format for comparison
function normalizeTime(timeStr) {
  // Convert "9:30 AM" to "9:30 am", "2:00 PM" to "2:00 pm" 
  return timeStr.toLowerCase().replace(/\s+/g, ' ');
}

export default function ScheduleCalendar({ currentDay, selectedOC }) {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');

  useEffect(() => {
    fetchInterviews();
  }, [currentDay, selectedOC]);

  async function fetchInterviews() {
    setLoading(true);
    try {
      // Calculate the week number from current day
      const weekNumber = Math.ceil(currentDay / 5);
      const weekStartDay = (weekNumber - 1) * 5 + 1;
      const weekEndDay = weekNumber * 5;

      // Fetch all interviews for this week (5 days)
      const allInterviews = [];
      for (let day = weekStartDay; day <= weekEndDay; day++) {
        const params = new URLSearchParams();
        params.append('day', day);
        if (selectedOC) params.append('ocId', selectedOC);

        const res = await fetch(`/api/interviews?${params}`);
        const data = await res.json();
        if (data.interviews) {
          allInterviews.push(...data.interviews);
        }
      }

      console.log(`Fetched ${allInterviews.length} interviews for week ${weekNumber} (Days ${weekStartDay}-${weekEndDay})`);
      setInterviews(allInterviews);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateInterviewStatus(interviewId, newStatus) {
    try {
      await fetch('/api/interviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: interviewId, status: newStatus }),
      });
      fetchInterviews();
      setSelectedInterview(null);
    } catch (error) {
      console.error('Error updating interview:', error);
    }
  }

  async function markAsDone(interviewId) {
    setActionLoading(true);
    try {
      const res = await fetch('/api/interview-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', interviewId }),
      });
      const result = await res.json();
      if (result.success) {
        alert('Interview marked as completed!');
        fetchInterviews();
        setSelectedInterview(null);
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error marking as done:', error);
      alert('Failed to mark interview as done');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReschedule() {
    if (!rescheduleReason.trim()) {
      alert('Please provide a reason for rescheduling');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/interview-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reschedule', 
          interviewId: selectedInterview.id,
          reason: rescheduleReason 
        }),
      });
      const result = await res.json();
      
      if (result.success) {
        let message = result.message;
        
        if (result.method === 'SWAP' && result.affectedCandidates) {
          message += '\n\nAffected candidates:\n' + 
            result.affectedCandidates.map(c => 
              `${c.name}: ${c.oldSlot} → ${c.newSlot}`
            ).join('\n');
        } else if (result.method === 'REBUILD') {
          message += `\n\n${result.scheduled} interviews rescheduled optimally.`;
          if (result.unscheduled > 0) {
            message += `\n${result.unscheduled} candidates could not be scheduled.`;
          }
        }
        
        alert(message);
        fetchInterviews();
        setSelectedInterview(null);
        setShowRescheduleModal(false);
        setRescheduleReason('');
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      alert('Failed to reschedule interview');
    } finally {
      setActionLoading(false);
    }
  }

  function getInterviewsForDayAndTime(day, timeSlot) {
    const filtered = interviews.filter((interview) => {
      if (!interview.startTime) return false;
      
      const interviewDate = new Date(interview.startTime);
      if (isNaN(interviewDate.getTime())) return false;
      
      // Map dayNumber to day of week: Day 1=Monday, Day 2=Tuesday, etc.
      // dayNumber cycles every 5 days (Monday-Friday)
      const expectedDayOfWeek = ((interview.dayNumber - 1) % 5); // 0=Monday, 1=Tuesday, ..., 4=Friday
      const expectedDayName = DAYS_OF_WEEK[expectedDayOfWeek];
      
      // Get the time
      const interviewTime = format(interviewDate, 'h:mm a');
      
      const dayMatch = expectedDayName === day;
      const timeMatch = normalizeTime(interviewTime) === normalizeTime(timeSlot);
      
      // Match both day name and time (case-insensitive)
      return dayMatch && timeMatch;
    });
    
    return filtered;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="text-gray-600">Loading schedule...</div>
      </div>
    );
  }

  const weekNumber = Math.ceil(currentDay / 5);
  const weekStartDay = (weekNumber - 1) * 5 + 1;
  const weekEndDay = weekNumber * 5;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-gray-50 border-b px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Week {weekNumber} Schedule
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Days {weekStartDay}-{weekEndDay} • {interviews.length} interview{interviews.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-32">
                Time
              </th>
              {DAYS_OF_WEEK.map((day) => (
                <th
                  key={day}
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {TIME_SLOTS.map((timeSlot) => (
              <tr key={timeSlot} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-600 whitespace-nowrap">
                  {timeSlot}
                </td>
                {DAYS_OF_WEEK.map((day) => {
                  const dayInterviews = getInterviewsForDayAndTime(day, timeSlot);
                  
                  return (
                    <td key={day} className="px-4 py-3">
                      {dayInterviews.length > 0 ? (
                        <div className="space-y-2">
                          {dayInterviews.map((interview) => (
                            <button
                              key={interview.id}
                              onClick={() => setSelectedInterview(interview)}
                              className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                                interview.status === 'COMPLETED' || interview.isCompleted
                                  ? 'bg-green-100 border-green-300 border'
                                  : interview.status === 'CANCELLED'
                                  ? 'bg-red-100 border-red-300 border'
                                  : 'bg-blue-100 border-blue-300 border hover:bg-blue-200'
                              }`}
                            >
                              <div className="font-semibold text-gray-900 truncate">
                                {interview.candidate.name}
                              </div>
                              <div className="text-xs text-gray-600 mt-1 truncate">
                                {interview.candidate.department}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {interview.oc1.name.split(' ')[0]} & {interview.oc2.name.split(' ')[0]}
                              </div>
                              <div className="text-xs font-medium text-blue-600 mt-1">
                                60 mins
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-400 text-sm">
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interview Detail Modal */}
      {selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Interview Details
              </h3>
              <button
                onClick={() => setSelectedInterview(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Candidate</label>
                <p className="text-lg font-semibold text-black">{selectedInterview.candidate.name}</p>
                <p className="text-sm text-gray-600">{selectedInterview.candidate.rollNumber}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Department</label>
                  <p className="text-sm text-black">{selectedInterview.candidate.department}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-sm text-black">{selectedInterview.candidate.email}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Interviewers</label>
                <p className="text-sm text-black">
                  {selectedInterview.oc1.name} & {selectedInterview.oc2.name}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Scheduled Time</label>
                <p className="text-sm text-black">
                  {format(new Date(selectedInterview.startTime), 'EEEE, MMMM d, yyyy - h:mm a')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Duration: 60 minutes
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <p className="text-sm">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedInterview.status === 'COMPLETED' || selectedInterview.isCompleted
                        ? 'bg-green-100 text-green-800'
                        : selectedInterview.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedInterview.isCompleted ? 'COMPLETED' : selectedInterview.status}
                  </span>
                </p>
              </div>

              {selectedInterview.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Notes</label>
                  <p className="text-sm">{selectedInterview.notes}</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                {selectedInterview.status === 'SCHEDULED' && !selectedInterview.isCompleted && (
                  <>
                    <button
                      onClick={() => markAsDone(selectedInterview.id)}
                      disabled={actionLoading}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {actionLoading ? 'Processing...' : 'Mark as Done'}
                    </button>
                    <button
                      onClick={() => setShowRescheduleModal(true)}
                      disabled={actionLoading}
                      className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => updateInterviewStatus(selectedInterview.id, 'CANCELLED')}
                      disabled={actionLoading}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {selectedInterview.status === 'COMPLETED' && (
                  <div className="flex-1 text-center text-green-700 font-medium">
                    ✓ This interview has been completed
                  </div>
                )}
                {selectedInterview.status === 'CANCELLED' && (
                  <button
                    onClick={() => updateInterviewStatus(selectedInterview.id, 'SCHEDULED')}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Confirmation Modal */}
      {showRescheduleModal && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Reschedule Interview
              </h3>
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setRescheduleReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  You are about to reschedule the interview for:
                </p>
                <p className="font-semibold text-black">{selectedInterview.candidate.name}</p>
                <p className="text-sm text-gray-600">
                  {format(new Date(selectedInterview.startTime), 'EEEE, MMMM d, yyyy - h:mm a')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Rescheduling *
                </label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  rows="3"
                  placeholder="e.g., Candidate unavailable, conflict with another commitment..."
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> The system will try to find an optimal swap first. 
                  If not possible, it will rebuild future weeks to maintain schedule optimality. 
                  This may affect other interviews in upcoming weeks.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleReason('');
                  }}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={actionLoading || !rescheduleReason.trim()}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Confirm Reschedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
