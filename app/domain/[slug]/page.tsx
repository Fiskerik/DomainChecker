import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Metadata } from 'next';
import { getBackorderPrice, getEstimatedValue, getNamecheapAffiliateUrl } from '@/lib/domain-utils';

interface Domain {
  id: number;
  domain_name: string;
  tld: string;
  drop_date: string;
  days_until_drop: number;
  popularity_score: number;
  category: string;
  registrar?: string;
  status: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALTERNATIVE_TLDS = ['com', 'io', 'ai', 'app', 'dev'];

function parseSlug(slug: string): { root: string; tld: string } {
  const normalizedSlug = slug.toLowerCase();
  const dashIndex = normalizedSlug.lastIndexOf('-');

  if (dashIndex === -1 || dashIndex === normalizedSlug.length - 1) {
    return { root: normalizedSlug, tld: '' };
  }

  return {
    root: normalizedSlug.slice(0, dashIndex),
    tld: normalizedSlug.slice(dashIndex + 1),
  };
}

function slugRootToDomainRoot(root: string): string {
  return root.replace(/-/g, '.');
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { root, tld } = parseSlug(params.slug);
  const domainName = `${slugRootToDomainRoot(root)}.${tld}`;

  return {
    title: `${domainName} expiring domain details | Domain Checker`,
    description: `Track ${domainName} drop date, value estimate, and alternative TLD opportunities before this domain drops.`,
  };
}

export default async function DomainDetailPage({ params }: { params: { slug: string } }) {
  const { root, tld } = parseSlug(params.slug);
  const domainRoot = slugRootToDomainRoot(root);
  const exactDomain = `${domainRoot}.${tld}`;

  const { data: allVariants, error } = await supabase
    .from('domains')
    .select('id, domain_name, tld, drop_date, days_until_drop, popularity_score, category, registrar, status')
    .ilike('domain_name', `${domainRoot}.%`)
    .order('popularity_score', { ascending: false });

  if (error || !allVariants || allVariants.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Domain not found</h1>
          <p className="mt-2 text-slate-600">We could not find data for this domain yet.</p>
          <Link href="/" className="mt-4 inline-block text-slate-900 underline underline-offset-4">
            Back to listings
          </Link>
        </div>
      </main>
    );
  }

  const currentDomain =
    allVariants.find((entry) => entry.domain_name.toLowerCase() === exactDomain.toLowerCase()) || allVariants[0];

  const alternatives = ALTERNATIVE_TLDS.map((candidateTld) => {
    const existing = allVariants.find((entry) => entry.tld === candidateTld);

    if (existing) {
      return {
        domain: `${domainRoot}.${candidateTld}`,
        statusLabel:
          existing.status === 'pending_delete'
            ? `Drops in ${existing.days_until_drop} days`
            : 'Registered',
        marker: existing.status === 'pending_delete' ? '⏰' : '❌',
      };
    }

    return {
      domain: `${domainRoot}.${candidateTld}`,
      statusLabel: 'Available now (est. $12.99)',
      marker: '✅',
    };
  });

  const similarDomains = allVariants.filter((entry) => entry.id !== currentDomain.id).slice(0, 4);

  const affiliateUrls = {
    namecheap: getNamecheapAffiliateUrl(currentDomain.domain_name),
    snapnames: `https://www.snapnames.com/search?query=${currentDomain.domain_name}&aff=${process.env.NEXT_PUBLIC_SNAPNAMES_AFF_ID || ''}`,
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/" className="inline-block text-sm text-slate-700 underline underline-offset-4">
          ← Back to all domains
        </Link>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{currentDomain.domain_name}</h1>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              {currentDomain.category}
            </span>
          </div>
          <p className="mt-3 text-slate-600">
            Expiring domain profile with countdown, value estimate, and TLD alternatives.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Drop countdown</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{currentDomain.days_until_drop} days</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Drop date</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {new Date(currentDomain.drop_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Estimated value</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{getEstimatedValue(currentDomain)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Backorder pricing snapshot</p>
            <p className="mt-1">SnapNames: {getBackorderPrice('snapnames')} · DropCatch: {getBackorderPrice('dropcatch')}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={affiliateUrls.snapnames}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Backorder on SnapNames
            </a>
            <a
              href={affiliateUrls.namecheap}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Check availability on Namecheap
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Alternative TLDs</h2>
          <ul className="mt-4 space-y-3">
            {alternatives.map((alternative) => (
              <li
                key={alternative.domain}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
              >
                <span className="text-slate-900">
                  {alternative.marker} {alternative.domain}
                </span>
                <span className="text-sm text-slate-600">{alternative.statusLabel}</span>
              </li>
            ))}
          </ul>
        </section>

        {similarDomains.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Similar domains</h2>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {similarDomains.map((similar) => (
                <li key={similar.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{similar.domain_name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Drops in {similar.days_until_drop} days · Score {similar.popularity_score}/100
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
