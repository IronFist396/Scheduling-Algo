import { useState, useEffect } from 'react';
import Link from 'next/link';
import ScheduleCalendar from '../components/ScheduleCalendar';
import StatsPanel from '../components/StatsPanel';
import ScheduleControls from '../components/ScheduleControls';
import TodayInterviews from '../components/TodayInterviews';
import { calculateCurrentDay } from '../lib/dateUtils';

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
      
      // Auto-jump to current week based on schedule start date
      if (data.scheduleStartDate) {
        const currentDay = calculateCurrentDay(data.scheduleStartDate);
        setCurrentDay(currentDay);
      }
      
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
      <header className="bg-[#142749] shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">
              ISMP Interview Scheduler
            </h1>
            <div className="flex items-center gap-3">
              <Link
                href="/history"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <span>📜</span>
                <span>Action History</span>
              </Link>
              <button
                onClick={runScheduler}
                disabled={scheduling}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scheduling ? 'Scheduling...' : '🚀 Run Auto-Schedule'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Panel */}
        <StatsPanel stats={stats} />

        {/* Today's Interviews Widget */}
        <TodayInterviews />

        {/* Controls */}
        <ScheduleControls
          currentDay={currentDay}
          setCurrentDay={setCurrentDay}
          selectedOC={selectedOC}
          setSelectedOC={setSelectedOC}
          ocs={stats?.ocs || []}
          maxWeek={stats?.weeksUsed || 1}
          daysUsed={stats?.daysUsed || 0}
          weeksUsed={stats?.weeksUsed || 0}
          scheduleStartDate={stats?.scheduleStartDate}
        />

        {/* Calendar */}
        <ScheduleCalendar
          currentDay={currentDay}
          selectedOC={selectedOC}
          scheduleStartDate={stats?.scheduleStartDate}
        />
      </main>
    </div>
  );
}
