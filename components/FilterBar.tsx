'use client';

import { RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';

interface FilterBarProps {
  filters: any;
  onFilterChange: (filters: any) => void;
  onRefresh: () => void;
}

export function FilterBar({ filters, onFilterChange, onRefresh }: FilterBarProps) {
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
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domains..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </form>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* TLD Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">TLD:</span>
          {['all', 'com', 'io', 'ai', 'app', 'dev'].map((tld) => (
            <button
              key={tld}
              onClick={() => onFilterChange({ ...filters, tld: tld === 'all' ? undefined : tld })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (tld === 'all' && !filters.tld) || filters.tld === tld
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tld === 'all' ? 'All' : `.${tld}`}
            </button>
          ))}
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Category:</span>
          {['all', 'tech', 'finance', 'ecommerce', 'gaming'].map((category) => (
            <button
              key={category}
              onClick={() => onFilterChange({ ...filters, category: category === 'all' ? undefined : category })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (category === 'all' && !filters.category) || filters.category === category
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm font-semibold text-gray-700">Sort:</span>
          <select
            value={filters.sort || 'popularity_score'}
            onChange={(e) => onFilterChange({ ...filters, sort: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="popularity_score">Popularity</option>
            <option value="drop_date">Drop Date</option>
            <option value="created_at">Recently Added</option>
          </select>

          {/* Sort Order Toggle */}
          <button
            onClick={() => onFilterChange({ 
              ...filters, 
              order: filters.order === 'asc' ? 'desc' : 'asc' 
            })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors font-bold"
            title={filters.order === 'asc' ? 'Ascending - Click for Descending' : 'Descending - Click for Ascending'}
          >
            {filters.order === 'asc' ? '↑ ASC' : '↓ DESC'}
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh domains"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Active Filters Display */}
      {(filters.tld || filters.category || filters.search) && (
        <div className="mt-3 pt-3 border-t flex items-center gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
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
          <button
            onClick={() => {
              setSearch('');
              onFilterChange({});
            }}
            className="text-xs text-blue-600 hover:text-blue-700 ml-2"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
