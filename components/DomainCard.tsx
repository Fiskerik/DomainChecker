'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getBackorderPrice, getDomainRoot, getEstimatedValue, getNamecheapAffiliateUrl } from '@/lib/domain-utils';

interface Domain {
  id: number;
  domain_name: string;
  tld: string;
  drop_date: string;
  days_until_drop: number;
  popularity_score: number;
  category: string;
  registrar?: string;
  view_count: number;
  click_count_total: number;
}

interface DomainCardProps {
  domains: Domain[];
}

export function DomainCard({ domains }: DomainCardProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isTracking, setIsTracking] = useState(false);

  const sortedDomains = useMemo(
    () => [...domains].sort((a, b) => b.popularity_score - a.popularity_score),
    [domains]
  );

  const domain = sortedDomains[selectedIndex] ?? sortedDomains[0];

  const handleAffiliateClick = async (type: 'namecheap' | 'snapnames') => {
    setIsTracking(true);
    try {
      await fetch('/api/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_id: domain.id,
          affiliate_type: type,
        }),
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    } finally {
      setIsTracking(false);
    }

    const affiliateUrls = {
      namecheap: getNamecheapAffiliateUrl(domain.domain_name),
      snapnames: `https://www.snapnames.com/search?query=${domain.domain_name}&aff=${process.env.NEXT_PUBLIC_SNAPNAMES_AFF_ID || ''}`,
    };

    window.open(affiliateUrls[type], '_blank');
  };

  const handleCardClick = async () => {
    try {
      await fetch('/api/track/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain_id: domain.id }),
      });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const urgencyTone =
    domain.days_until_drop <= 5 ? 'text-red-700 bg-red-50 border-red-100' :
    domain.days_until_drop <= 10 ? 'text-amber-700 bg-amber-50 border-amber-100' :
    'text-emerald-700 bg-emerald-50 border-emerald-100';

  const domainSlug = `${getDomainRoot(domain.domain_name)}-${domain.tld}`;

  return (
    <div className="relative pt-4">
      {sortedDomains.length > 1 && (
        <>
          <div className="absolute left-2 right-2 top-2 h-full rounded-2xl border border-slate-200 bg-slate-100" />
          <div className="absolute left-1 right-1 top-1 h-full rounded-2xl border border-slate-200 bg-white" />
        </>
      )}

      <article
        className="relative rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-xl font-semibold text-slate-900 break-all">{domain.domain_name}</h3>
            {sortedDomains.length > 1 && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                {sortedDomains.length} variants
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">.{domain.tld}</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{domain.category}</span>
            {domain.popularity_score >= 70 && (
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">High interest</span>
            )}
          </div>

          {sortedDomains.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {sortedDomains.map((entry, index) => (
                <button
                  key={entry.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedIndex(index);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    index === selectedIndex
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  .{entry.tld}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className={`rounded-xl border p-3 ${urgencyTone}`}>
            <p className="text-sm font-semibold">Drops in {domain.days_until_drop} days</p>
            <p className="mt-1 text-xs">
              {new Date(domain.drop_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm text-slate-600">Popularity</span>
              <span className="text-sm font-semibold text-slate-900">{domain.popularity_score}/100</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-slate-900 transition-all duration-500"
                style={{ width: `${domain.popularity_score}%` }}
              />
            </div>
          </div>

          {(domain.view_count > 0 || domain.click_count_total > 0) && (
            <p className="text-xs text-slate-500">
              {domain.view_count} views · {domain.click_count_total} clicks
            </p>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">Estimated domain value</p>
            <p className="mt-1 text-lg font-semibold text-amber-800">{getEstimatedValue(domain)}</p>
            <div className="mt-2 text-xs text-amber-700 flex flex-wrap gap-3">
              <span>SnapNames backorder: {getBackorderPrice('snapnames')}</span>
              <span>DropCatch backorder: {getBackorderPrice('dropcatch')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleAffiliateClick('snapnames');
              }}
              disabled={isTracking}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              Backorder on SnapNames
            </button>

            <button
              onClick={(event) => {
                event.stopPropagation();
                handleAffiliateClick('namecheap');
              }}
              disabled={isTracking}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Check on Namecheap
            </button>

            <Link
              href={`/domain/${domainSlug}`}
              onClick={(event) => event.stopPropagation()}
              className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              View domain details
            </Link>
          </div>

          {domain.registrar && (
            <p className="text-center text-xs text-slate-400">Currently at {domain.registrar}</p>
          )}
        </div>
      </article>
    </div>
  );
}
