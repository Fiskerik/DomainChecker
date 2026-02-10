'use client';

import { useEffect, useMemo, useState } from 'react';
import { DomainCard } from '@/components/DomainCard';
import { FilterBar } from '@/components/FilterBar';
import { StatsBar } from '@/components/StatsBar';
import { getDomainRoot } from '@/lib/domain-utils';

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
  search?: string;
  order?: string;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({});
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchDomains();
  }, [filters]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'pending_delete');

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      });

      const response = await fetch(`/api/domains?${params.toString()}`);
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

  const groupedDomains = useMemo(() => {
    const groups = new Map<string, Domain[]>();

    domains.forEach((domain) => {
      const key = getDomainRoot(domain.domain_name);

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)?.push(domain);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const firstGroupScore = Math.max(...a.map((entry) => entry.popularity_score));
      const secondGroupScore = Math.max(...b.map((entry) => entry.popularity_score));
      return secondGroupScore - firstGroupScore;
    });
  }, [domains]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Premium Domains Dropping Soon
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Review pending delete domains, compare TLD variants, and act before they drop.
          </p>
        </div>
      </header>

      {stats && <StatsBar stats={stats} />}

      <main className="max-w-7xl mx-auto px-4 py-8">
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          onRefresh={fetchDomains}
        />

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900"></div>
          </div>
        ) : groupedDomains.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-slate-500">No domains found with current filters.</p>
            <button
              onClick={() => setFilters({})}
              className="mt-4 text-slate-900 underline underline-offset-4"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {groupedDomains.map((domainGroup) => (
              <DomainCard
                key={getDomainRoot(domainGroup[0].domain_name)}
                domains={domainGroup}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
