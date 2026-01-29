import { useRouter } from 'next/router';

export default function StatsPanel({ stats }) {
  const router = useRouter();

  if (!stats) return null;

  const handleCardClick = (status) => {
    if (status) {
      router.push(`/candidates?status=${status}`);
    }
  };

  const statCards = [
    {
      label: 'Total Candidates',
      value: stats.totalCandidates,
      color: 'bg-blue-50 text-blue-700',
      icon: '👥',
      status: null,
      clickable: false,
    },
    {
      label: 'Scheduled',
      value: stats.scheduled,
      color: 'bg-green-50 text-green-700',
      icon: '✅',
      status: 'SCHEDULED',
      clickable: true,
    },
    {
      label: 'Completed',
      value: stats.completed,
      color: 'bg-purple-50 text-purple-700',
      icon: '🎯',
      status: 'COMPLETED',
      clickable: true,
    },
    {
      label: 'Unscheduled',
      value: stats.unscheduled,
      color: 'bg-orange-50 text-orange-700',
      icon: '⏳',
      status: 'PENDING',
      clickable: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {statCards.map((stat, index) => (
        <div
          key={index}
          onClick={() => stat.clickable && handleCardClick(stat.status)}
          className={`${stat.color} rounded-lg p-6 shadow-sm ${
            stat.clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">{stat.label}</p>
              <p className="text-3xl font-bold mt-2">{stat.value}</p>
            </div>
            <div className="text-4xl">{stat.icon}</div>
          </div>
          {stat.clickable && (
            <p className="text-xs opacity-60 mt-2">Click to view candidates</p>
          )}
        </div>
      ))}
    </div>
  );
}
