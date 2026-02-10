'use client';

interface StatsBarProps {
  stats: {
    total_pending: number;
    hot_domains: number;
    dropping_this_week: number;
    by_tld?: Record<string, number>;
  };
}

export function StatsBar({ stats }: StatsBarProps) {
  const topTLDs = stats.by_tld
    ? Object.entries(stats.by_tld)
        .sort(([, first], [, second]) => second - first)
        .slice(0, 3)
    : [];

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Total Pending Delete</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total_pending}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">High Interest Domains (70+)</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.hot_domains}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Dropping This Week</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.dropping_this_week}</p>
          </div>
        </div>

        {topTLDs.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm text-slate-600">Top TLDs</p>
            <div className="flex flex-wrap gap-2">
              {topTLDs.map(([tld, count]) => (
                <span key={tld} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  .{tld} ({count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
