'use client';

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

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    onFilterChange({ ...filters, search });
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <form onSubmit={handleSearch} className="mb-4">
        <label htmlFor="domain-search" className="mb-2 block text-sm font-medium text-slate-700">
          Search
        </label>
        <input
          id="domain-search"
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find domains"
          className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-slate-900 focus:outline-none"
        />
      </form>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-700">TLD:</span>
          {['all', 'com', 'io', 'ai', 'app', 'dev'].map((tld) => (
            <button
              key={tld}
              onClick={() => onFilterChange({ ...filters, tld: tld === 'all' ? undefined : tld })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                (tld === 'all' && !filters.tld) || filters.tld === tld
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tld === 'all' ? 'All' : `.${tld}`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-700">Category:</span>
          {['all', 'tech', 'finance', 'ecommerce', 'gaming'].map((category) => (
            <button
              key={category}
              onClick={() => onFilterChange({ ...filters, category: category === 'all' ? undefined : category })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                (category === 'all' && !filters.category) || filters.category === category
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Sort:</span>
          <select
            value={filters.sort || 'popularity_score'}
            onChange={(event) => onFilterChange({ ...filters, sort: event.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          >
            <option value="popularity_score">Popularity</option>
            <option value="drop_date">Drop Date</option>
            <option value="created_at">Recently Added</option>
          </select>

          <button
            onClick={() =>
              onFilterChange({
                ...filters,
                order: filters.order === 'asc' ? 'desc' : 'asc',
              })
            }
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-slate-50"
            title={filters.order === 'asc' ? 'Ascending - Click for Descending' : 'Descending - Click for Ascending'}
          >
            {filters.order === 'asc' ? 'ASC' : 'DESC'}
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-slate-50 disabled:opacity-50"
            title="Refresh domains"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {(filters.tld || filters.category || filters.search) && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 flex-wrap">
          <span className="text-sm text-slate-600">Active filters:</span>
          {filters.tld && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              .{filters.tld}
              <button
                onClick={() => onFilterChange({ ...filters, tld: undefined })}
                className="ml-1.5 hover:text-slate-900"
              >
                ×
              </button>
            </span>
          )}
          {filters.category && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {filters.category}
              <button
                onClick={() => onFilterChange({ ...filters, category: undefined })}
                className="ml-1.5 hover:text-slate-900"
              >
                ×
              </button>
            </span>
          )}
          {filters.search && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              "{filters.search}"
              <button
                onClick={() => {
                  setSearch('');
                  onFilterChange({ ...filters, search: undefined });
                }}
                className="ml-1.5 hover:text-slate-900"
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
            className="text-xs text-slate-900 underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      )}
    </section>
  );
}
