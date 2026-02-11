'use client';

import { useEffect, useState } from 'react';
import { DomainCard } from '@/components/DomainCard';
import { FilterBar } from '@/components/FilterBar';
import { StatsBar } from '@/components/StatsBar';

interface Domain {
  id: number;
  domain_name: string;
  tld: string;
  drop_date: string;
  days_until_drop: number;
  popularity_score: number;
  category: string;
  registrar: string;
  view_count: number;
  click_count_total: number;
  slug: string;
}

interface Filters {
  tld?: string;
  category?: string;
  min_score?: number;
  sort?: string;
  order?: string;
  search?: string;
}

export default function ImprovedDomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({});
  const [stats, setStats] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Load view preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('viewMode');
    if (saved === 'list' || saved === 'card') {
      setViewMode(saved);
    }
  }, []);

  // Save view preference
  const handleViewModeChange = (mode: 'card' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
  };

  // Fetch domains
  useEffect(() => {
    fetchDomains();
  }, [filters]);

  // Fetch stats once
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: 'pending_delete',
        ...(filters as any),
      });

      const response = await fetch(`/api/domains?${params}`);
      const data = await response.json();

      setDomains(data.domains || []);
    } catch (error) {
      console.error('Error fetching domains:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Compact on mobile */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            🎯 Premium Domains
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Dropping in 5-15 days
          </p>
        </div>
      </header>

      {/* Stats Bar - Compact on mobile */}
      {stats && <StatsBar stats={stats} />}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Filter Bar */}
        <div className="mb-4 sm:mb-6">
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            onRefresh={fetchDomains}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        </div>

        {/* Domain Grid/List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : domains.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-base sm:text-lg">No domains found</p>
            <button
              onClick={() => setFilters({})}
              className="mt-4 text-sm sm:text-base text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className={
            viewMode === 'card'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4'
              : 'space-y-2 sm:space-y-3'
          }>
            {domains.map((domain) => (
              <DomainCard
                key={domain.id}
                domain={domain}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}

        {/* Results Count */}
        {!loading && domains.length > 0 && (
          <p className="text-center text-xs sm:text-sm text-gray-500 mt-6">
            Showing {domains.length} domain{domains.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
