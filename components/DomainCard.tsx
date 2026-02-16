'use client';

import Link from 'next/link';
import { Calendar, TrendingUp, Eye, MousePointerClick } from 'lucide-react';

interface Domain {
  id: number | string;
  domain_name: string;
  slug: string;
  tld: string;
  expiry_date?: string;
  drop_date: string;
  days_until_drop: number;
  popularity_score: number;
  category: string;
  status?: string;
  registrar?: string;
  estimated_value?: string;
  view_count?: number;
  click_count_total?: number;
}

interface DomainCardProps {
  domain: Domain;
  viewMode?: 'card' | 'list';
}

export function DomainCard({ domain, viewMode = 'card' }: DomainCardProps) {
  const scoreColor = 
    domain.popularity_score >= 75 ? 'text-emerald-600' :
    domain.popularity_score >= 50 ? 'text-blue-600' :
    'text-slate-600';

  const statusBadge = 
    domain.days_until_drop <= 3 ? (
      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
        🔥 {domain.days_until_drop}d
      </span>
    ) : (
      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
        {domain.days_until_drop}d
      </span>
    );

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <Link 
        href={`/domain/${domain.slug}`}
        className="group block rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Domain Name */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 truncate">
              {domain.domain_name}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="capitalize">{domain.category}</span>
              <span>•</span>
              <span>{domain.registrar || 'Unknown'}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-2xl font-bold ${scoreColor}`}>
                {domain.popularity_score}
              </div>
              <div className="text-xs text-slate-500">Score</div>
            </div>

            <div className="text-right">
              {statusBadge}
              <div className="mt-1 text-xs text-slate-500">
                {new Date(domain.drop_date).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // CARD VIEW (default)
  return (
    <Link 
      href={`/domain/${domain.slug}`}
      className="group block rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 truncate">
            {domain.domain_name}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-slate-500">.{domain.tld}</span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs capitalize text-slate-500">{domain.category}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1 ml-2">
          <div className={`text-2xl font-bold ${scoreColor}`}>
            {domain.popularity_score}
          </div>
          <div className="text-xs text-slate-500">Score</div>
        </div>
      </div>

      {/* Status & Timing */}
      <div className="mt-3 flex items-center gap-2">
        {statusBadge}
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(domain.drop_date).toLocaleDateString()}
        </span>
      </div>

      {/* Stats */}
      {(domain.view_count || domain.click_count_total) && (
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          {domain.view_count !== undefined && (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {domain.view_count}
            </span>
          )}
          {domain.click_count_total !== undefined && (
            <span className="flex items-center gap-1">
              <MousePointerClick className="h-3 w-3" />
              {domain.click_count_total}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
