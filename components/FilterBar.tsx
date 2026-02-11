'use client';

import { LayoutGrid, List, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';

interface ImprovedFilterBarProps {
  filters: any;
  onFilterChange: (filters: any) => void;
  onRefresh: () => void;
  viewMode: 'card' | 'list';
  onViewModeChange: (mode: 'card' | 'list') => void;
}

export function ImprovedFilterBar({ 
  filters, 
  onFilterChange, 
  onRefresh,
  viewMode,
  onViewModeChange
}: ImprovedFilterBarProps) {
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domains..."
            className="w-full pl-10 pr-4 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </form>

      {/* Filters */}
      <div className="p-3 sm:p-4 space-y-3">
        {/* View Mode Toggle - Desktop */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-2">
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

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
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

        {/* Sort Options */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Sort By</label>
            <select
              value={filters.sort || 'popularity_score'}
              onChange={(e) => onFilterChange({ ...filters, sort: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="popularity_score">Popularity</option>
              <option value="drop_date">Drop Date</option>
              <option value="created_at">Recently Added</option>
              <option value="domain_name">Name (A-Z)</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Order</label>
            <select
              value={filters.order || 'desc'}
              onChange={(e) => onFilterChange({ ...filters, order: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">High to Low</option>
              <option value="asc">Low to High</option>
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {(filters.tld || filters.category || filters.search) && (
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
              </div>
              <button
                onClick={() => {
                  setSearch('');
                  onFilterChange({});
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Mobile View Toggle */}
        <div className="flex sm:hidden items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-700">View</span>
          <div className="flex gap-2">
            <button
              onClick={() => onViewModeChange('card')}
              className={`px-3 py-1.5 text-xs rounded ${
                viewMode === 'card'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`px-3 py-1.5 text-xs rounded ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FilterBar;
