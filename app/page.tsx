'use client';

import { useEffect, useState } from 'react';
import { DomainCard } from '@/components/DomainCard';
import { FilterBar } from '@/components/FilterBar';
import { StatsBar } from '@/components/StatsBar';
import { Pagination } from '@/components/Pagination';

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
  status_mode?: 'exclude_pending_delete' | 'all' | 'pending_delete' | 'grace' | 'redemption' | 'dropped';
  tld?: string;
  category?: string;
  min_score?: number;
  max_score?: number;
  sort?: string;
  order?: string;
  search?: string;
}

export default function ImprovedDomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    status_mode: 'pending_delete', // Changed to show available domains
    sort: 'popularity_score',
    order: 'desc', // Show best domains first
  });
  const [stats, setStats] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

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
  }, [filters, currentPage, itemsPerPage]);

  // Reset to first page when filters or items per page change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, itemsPerPage]);

  // Fetch stats once
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(itemsPerPage),
        offset: String((currentPage - 1) * itemsPerPage),
        ...(filters as any),
      });

      const response = await fetch(`/api/domains?${params}`);
      const data = await response.json();

      setDomains(data.domains || []);
      setTotalCount(data.count || 0);
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Compact on mobile */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            🎯 Premium Domains
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Available for registration
          </p>
        </div>
      </header>

      {/* Stats Bar - Compact on mobile */}
      {stats && <StatsBar initialStats={stats} />}

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
              onClick={() => setFilters({ status_mode: 'pending_delete', sort: 'popularity_score', order: 'desc' })}
              className="mt-4 text-sm sm:text-base text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
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

            {/* Enhanced Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}