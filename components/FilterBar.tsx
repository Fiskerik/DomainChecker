'use client';

import { LayoutGrid, List, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';

interface FilterBarProps {
  filters: any;
  onFilterChange: (filters: any) => void;
  onRefresh: () => void;
  viewMode: 'card' | 'list';
  onViewModeChange: (mode: 'card' | 'list') => void;
}

export function FilterBar({ 
  filters, 
  onFilterChange, 
  onRefresh,
  viewMode,
  onViewModeChange
}: FilterBarProps) {
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const minScore = Number(filters.min_score ?? 0);
  const maxScore = Number(filters.max_score ?? 100);

  const updateScoreRange = (nextMin: number, nextMax: number) => {
    const safeMin = Number.isFinite(nextMin) ? nextMin : 0;
    const safeMax = Number.isFinite(nextMax) ? nextMax : 100;
    const normalizedMin = Math.max(0, Math.min(Math.round(safeMin), Math.round(safeMax)));
    const normalizedMax = Math.min(100, Math.max(Math.round(safeMin), Math.round(safeMax)));

    onFilterChange({
      ...filters,
      min_score: normalizedMin > 0 ? normalizedMin : undefined,
      max_score: normalizedMax < 100 ? normalizedMax : undefined,
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ ...filters, search });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="p-3 sm:p-4 border-b border-gray-100">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domains..."
            className="block w-full max-w-none appearance-none pl-10 pr-4 py-2 sm:py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </form>

      {/* Filters */}
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex justify-end">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-2 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'exclude_pending_delete', label: 'All (No Pending Delete)' },
              { value: 'all', label: 'All Statuses' },
              { value: 'grace', label: 'Grace' },
              { value: 'redemption', label: 'Redemption' },
              { value: 'dropped', label: 'Dropped' },
              { value: 'pending_delete', label: 'Pending Delete' },
            ].map((statusOption) => (
              <button
                key={statusOption.value}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    status_mode: statusOption.value,
                  })
                }
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors ${
                  (filters.status_mode || 'exclude_pending_delete') === statusOption.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {statusOption.label}
              </button>
            ))}
          </div>
        </div>

        {/* TLD Filter */}
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-2 block">TLD</label>
          <div className="flex flex-wrap gap-2">
            {['all', 'com', 'io', 'ai', 'app', 'dev'].map((tld) => (
              <button
                key={tld}
                onClick={() => onFilterChange({ ...filters, tld: tld === 'all' ? undefined : tld })}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors ${
                  (tld === 'all' && !filters.tld) || filters.tld === tld
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tld === 'all' ? 'All' : `.${tld}`}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-2 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {['all', 'tech', 'finance', 'ecommerce', 'gaming', 'health'].map((category) => (
              <button
                key={category}
                onClick={() => onFilterChange({ ...filters, category: category === 'all' ? undefined : category })}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors ${
                  (category === 'all' && !filters.category) || filters.category === category
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Popularity Range Filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">Popularity Score</label>
            <span className="text-xs text-gray-500 font-medium">
              {minScore} - {maxScore}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1 block">Min</label>
              <input
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => updateScoreRange(Number(e.target.value), maxScore)}
                className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                aria-label="Minimum popularity score"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1 block">Max</label>
              <input
                type="number"
                min={0}
                max={100}
                value={maxScore}
                onChange={(e) => updateScoreRange(minScore, Number(e.target.value))}
                className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                aria-label="Maximum popularity score"
              />
            </div>
          </div>
        </div>

        {/* Sort Options */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-5">
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Sort By</label>
            <select
              value={filters.sort || 'days_until_drop'}
              onChange={(e) => onFilterChange({ ...filters, sort: e.target.value })}
              className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="days_until_drop">Time Left to Expiry</option>
              <option value="popularity_score">Popularity</option>
              <option value="drop_date">Drop Date</option>
              <option value="created_at">Recently Added</option>
              <option value="domain_name">Name (A-Z)</option>
            </select>
          </div>

          <div className="sm:col-span-5">
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Order</label>
            <select
              value={filters.order || 'asc'}
              onChange={(e) => onFilterChange({ ...filters, order: e.target.value })}
              className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="asc">Ascending ↑</option>
              <option value="desc">Descending ↓</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-gray-700 mb-2 block">View</label>
            <div className="flex items-center gap-2 h-10">
              <button
                onClick={() => onViewModeChange('card')}
                className={`p-2 rounded ${
                  viewMode === 'card'
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Card view"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-2 rounded ${
                  viewMode === 'list'
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="List view"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {(filters.status_mode || filters.tld || filters.category || filters.search || filters.min_score !== undefined || filters.max_score !== undefined) && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {filters.tld && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    .{filters.tld}
                    <button
                      onClick={() => onFilterChange({ ...filters, tld: undefined })}
                      className="ml-1.5 hover:text-blue-900"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.status_mode && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Status: {filters.status_mode === 'exclude_pending_delete' ? 'No Pending Delete' : filters.status_mode.replace('_', ' ')}
                    <button
                      onClick={() => onFilterChange({ ...filters, status_mode: undefined })}
                      className="ml-1.5 hover:text-indigo-900"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.category && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {filters.category}
                    <button
                      onClick={() => onFilterChange({ ...filters, category: undefined })}
                      className="ml-1.5 hover:text-purple-900"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.search && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    "{filters.search}"
                    <button
                      onClick={() => {
                        setSearch('');
                        onFilterChange({ ...filters, search: undefined });
                      }}
                      className="ml-1.5 hover:text-gray-900"
                    >
                      ×
                    </button>
                  </span>
                )}
                {(filters.min_score !== undefined || filters.max_score !== undefined) && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Score {minScore}-{maxScore}
                    <button
                      onClick={() => onFilterChange({ ...filters, min_score: undefined, max_score: undefined })}
                      className="ml-1.5 hover:text-emerald-900"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setSearch('');
                  onFilterChange({ status_mode: 'exclude_pending_delete', sort: 'days_until_drop', order: 'asc' });
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
