'use client';

import { TrendingUp, Clock, Flame } from 'lucide-react';

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
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Pending */}
          <div className="flex items-center gap-4">
            <div className="bg-white/20 rounded-lg p-3">
              <TrendingUp size={32} />
            </div>
            <div>
              <p className="text-sm opacity-90">Total Pending Delete</p>
              <p className="text-3xl font-bold">{stats.total_pending}</p>
            </div>
          </div>

          {/* Hot Domains */}
          <div className="flex items-center gap-4">
            <div className="bg-white/20 rounded-lg p-3">
              <Flame size={32} />
            </div>
            <div>
              <p className="text-sm opacity-90">Hot Domains (70+ score)</p>
              <p className="text-3xl font-bold">{stats.hot_domains}</p>
            </div>
          </div>

          {/* Dropping This Week */}
          <div className="flex items-center gap-4">
            <div className="bg-white/20 rounded-lg p-3">
              <Clock size={32} />
            </div>
            <div>
              <p className="text-sm opacity-90">Dropping This Week</p>
              <p className="text-3xl font-bold">{stats.dropping_this_week}</p>
            </div>
          </div>
        </div>

        {/* Top TLDs */}
        {topTLDs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-sm opacity-90 mb-2">Popular TLDs:</p>
            <div className="flex gap-3">
              {topTLDs.map(([tld, count]) => (
                <span key={tld} className="bg-white/20 px-3 py-1 rounded-full text-sm">
                  .{tld} ({count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
