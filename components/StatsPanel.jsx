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
      bg: 'bg-sky-100',
      text: 'text-sky-900',
      sub: 'text-sky-500',
      status: 'ALL',
      clickable: true,
    },
    {
      label: 'Scheduled',
      value: stats.scheduled,
      bg: 'bg-emerald-100',
      text: 'text-emerald-900',
      sub: 'text-emerald-500',
      status: 'SCHEDULED',
      clickable: true,
    },
    {
      label: 'Completed',
      value: stats.completed,
      bg: 'bg-violet-100',
      text: 'text-violet-900',
      sub: 'text-violet-500',
      status: 'COMPLETED',
      clickable: true,
    },
    {
      label: 'Unscheduled',
      value: stats.unscheduled,
      bg: 'bg-orange-100',
      text: 'text-orange-900',
      sub: 'text-orange-400',
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
          className={`${stat.bg} rounded-xl px-6 py-5 shadow-sm ${
            stat.clickable ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-widest ${stat.sub}`}>{stat.label}</p>
          <p className={`text-4xl font-bold mt-2 leading-none ${stat.text}`}>{stat.value}</p>
          {stat.clickable && (
            <p className={`text-xs mt-3 ${stat.sub}`}>View candidates &rarr;</p>
          )}
        </div>
      ))}
    </div>
  );
}
