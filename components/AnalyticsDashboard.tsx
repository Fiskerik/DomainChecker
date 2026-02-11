'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, MousePointer, Eye, DollarSign, Award, Calendar } from 'lucide-react';

interface Stats {
  total_domains: number;
  total_views: number;
  total_clicks: number;
  ctr: number;
  top_domains: Array<{
    domain_name: string;
    click_count_total: number;
    view_count: number;
    ctr: number;
  }>;
  clicks_by_affiliate: Record<string, number>;
  estimated_revenue: {
    today: number;
    week: number;
    month: number;
  };
}

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/analytics?range=${timeRange}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return <div>Error loading analytics</div>;
  }

  const estimatedEarnings = calculateEstimatedEarnings(stats.clicks_by_affiliate);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2">📊 Analytics Dashboard</h1>
          <p className="text-blue-100">Track your performance and revenue</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Time Range Selector */}
        <div className="flex gap-2 mb-6">
          {(['today', 'week', 'month', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {range === 'all' ? 'All Time' : range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Eye />}
            title="Total Views"
            value={stats.total_views.toLocaleString()}
            color="blue"
          />
          <StatCard
            icon={<MousePointer />}
            title="Total Clicks"
            value={stats.total_clicks.toLocaleString()}
            color="green"
          />
          <StatCard
            icon={<TrendingUp />}
            title="Click-Through Rate"
            value={`${stats.ctr.toFixed(2)}%`}
            color="purple"
          />
          <StatCard
            icon={<DollarSign />}
            title="Est. Revenue"
            value={`$${estimatedEarnings.toFixed(2)}`}
            color="yellow"
            subtitle={`This ${timeRange}`}
          />
        </div>

        {/* Revenue Breakdown */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Clicks by Affiliate */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Clicks by Affiliate</h2>
            <div className="space-y-3">
              {Object.entries(stats.clicks_by_affiliate).map(([affiliate, clicks]) => {
                const earnings = estimateAffiliateEarnings(affiliate, clicks);
                return (
                  <div key={affiliate} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-semibold capitalize">{affiliate}</h3>
                      <p className="text-sm text-gray-600">{clicks} clicks</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">${earnings.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">estimated</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Performing Domains */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Top Performing Domains</h2>
            <div className="space-y-3">
              {stats.top_domains.slice(0, 5).map((domain, index) => (
                <div key={domain.domain_name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{domain.domain_name}</h3>
                    <p className="text-xs text-gray-600">
                      {domain.click_count_total} clicks · {domain.view_count} views · {domain.ctr.toFixed(1)}% CTR
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue Projections */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="text-green-600" />
            Revenue Projections
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <ProjectionCard
              period="This Month"
              amount={stats.estimated_revenue.month}
              change="+15%"
            />
            <ProjectionCard
              period="Next Month"
              amount={stats.estimated_revenue.month * 1.3}
              change="+30%"
              projected
            />
            <ProjectionCard
              period="6 Months"
              amount={stats.estimated_revenue.month * 4}
              change="+300%"
              projected
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color, subtitle }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'yellow';
  subtitle?: string;
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      <div className={`w-12 h-12 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function ProjectionCard({ period, amount, change, projected }: any) {
  return (
    <div className="bg-white rounded-lg p-4 border border-green-200">
      <p className="text-sm text-gray-600 mb-1">{period}</p>
      <p className="text-2xl font-bold text-green-600">${amount.toFixed(2)}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-green-600 font-medium">{change}</span>
        {projected && <span className="text-xs text-gray-500">projected</span>}
      </div>
    </div>
  );
}

// Helper functions
function calculateEstimatedEarnings(clicksByAffiliate: Record<string, number>): number {
  let total = 0;
  Object.entries(clicksByAffiliate).forEach(([affiliate, clicks]) => {
    total += estimateAffiliateEarnings(affiliate, clicks);
  });
  return total;
}

function estimateAffiliateEarnings(affiliate: string, clicks: number): number {
  const conversionRates = {
    dropcatch: 0.10, // 10% conversion
    namecheap: 0.08,
    godaddy: 0.12,
    snapnames: 0.10,
    dynadot: 0.08,
  };

  const commissionPerSale = {
    dropcatch: 9,  // $9 per $59 backorder
    namecheap: 3,  // $3 per domain registration
    godaddy: 15,   // $15 average
    snapnames: 10, // $10 per $69 backorder
    dynadot: 2,    // $2 per registration
  };

  const affiliateKey = affiliate.toLowerCase();
  const conversionRate = conversionRates[affiliateKey as keyof typeof conversionRates] || 0.08;
  const commission = commissionPerSale[affiliateKey as keyof typeof commissionPerSale] || 5;

  return clicks * conversionRate * commission;
}

export default AnalyticsDashboard;
