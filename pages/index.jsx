import { useState, useEffect } from 'react';
import ScheduleCalendar from '../components/ScheduleCalendar';
import StatsPanel from '../components/StatsPanel';
import ScheduleControls from '../components/ScheduleControls';

export default function Home() {
  const [stats, setStats] = useState(null);
  const [currentDay, setCurrentDay] = useState(1);
  const [selectedOC, setSelectedOC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
      if (data.ocs && data.ocs.length > 0) {
        setSelectedOC(data.ocs[0].id);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function runScheduler() {
    if (!confirm('This will delete all existing interviews and create a new schedule. Continue?')) {
      return;
    }

    setScheduling(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2025-03-01', // Scheduler will find first Monday automatically
          maxDays: 999, // Unlimited days - schedule everyone
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        const msg = `✅ Scheduling Complete!\n\n` +
          `📊 Statistics:\n` +
          `• Total Candidates: ${data.stats.totalCandidates}\n` +
          `• Scheduled: ${data.stats.scheduled}\n` +
          `• Unscheduled: ${data.stats.unscheduled}\n\n` +
          `📅 Timeline:\n` +
          `• Working Days: ${data.stats.daysUsed}\n` +
          `• Weeks: ${data.stats.weeksUsed}\n\n` +
          (data.stats.unscheduled > 0 ? 
            `⚠️ ${data.stats.unscheduled} candidate(s) could not be scheduled (no common slots with OCs)` : 
            `✅ All candidates successfully scheduled!`);
        
        alert(msg);
        fetchStats();
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setScheduling(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              ISMP Interview Scheduler
            </h1>
            <button
              onClick={runScheduler}
              disabled={scheduling}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scheduling ? 'Scheduling...' : '🚀 Run Auto-Schedule'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Panel */}
        <StatsPanel stats={stats} />

        {/* Controls */}
        <ScheduleControls
          currentDay={currentDay}
          setCurrentDay={setCurrentDay}
          selectedOC={selectedOC}
          setSelectedOC={setSelectedOC}
          ocs={stats?.ocs || []}
        />

        {/* Calendar */}
        <ScheduleCalendar
          currentDay={currentDay}
          selectedOC={selectedOC}
        />
      </main>
    </div>
  );
}
