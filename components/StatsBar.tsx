'use client';

import { useEffect, useState } from 'react';

interface Stats {
  total_pending: number;
  hot_domains: number;
  dropping_this_week: number;
  by_tld?: Record<string, number>;
}

export function StatsBar({ initialStats }: { initialStats?: Stats }) {
  const [stats, setStats] = useState<Stats>(initialStats || {
    total_pending: 0,
    hot_domains: 0,
    dropping_this_week: 0,
    by_tld: {}
  });
  const [loading, setLoading] = useState(!initialStats);

  useEffect(() => {
    // Fetch fresh stats on mount and every 5 minutes
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats', {
          cache: 'no-store' // Disable caching to get fresh data
        });
        
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const topTLDs = stats.by_tld
    ? Object.entries(stats.by_tld)
        .sort(([, first], [, second]) => second - first)
        .slice(0, 3)
    : [];

  if (loading) {
    return (
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-slate-300 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Available Domains</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total_pending}</p>
            <p className="text-xs text-slate-500 mt-1">Ready to register</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">High Quality (70+)</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.hot_domains}</p>
            <p className="text-xs text-slate-500 mt-1">Premium selections</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Dropping This Week</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.dropping_this_week}</p>
            <p className="text-xs text-slate-500 mt-1">Next 7 days</p>
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