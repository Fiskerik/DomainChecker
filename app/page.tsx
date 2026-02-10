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
}

interface Filters {
  tld?: string;
  category?: string;
  min_score?: number;
  sort?: string;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({});
  const [stats, setStats] = useState<any>(null);

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
        ...filters,
      } as any);

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
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🎯 Premium Domains Dropping Soon
          </h1>
          <p className="text-gray-600 mt-2">
            Discover valuable domains in the pending delete phase (5-15 days before drop)
          </p>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && <StatsBar stats={stats} />}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filter Bar */}
        <FilterBar 
          filters={filters} 
          onFilterChange={setFilters}
          onRefresh={fetchDomains}
        />

        {/* Domain Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : domains.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No domains found with current filters</p>
            <button
              onClick={() => setFilters({})}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {domains.map((domain) => (
              <DomainCard key={domain.id} domain={domain} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
