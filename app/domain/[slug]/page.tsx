import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { DomainDetailView } from '@/components/DomainDetailView';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
  params: {
    slug: string;
  };
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const domain = await getDomainBySlug(params.slug);

  if (!domain) {
    return {
      title: 'Domain Not Found',
    };
  }

  const title = `${domain.domain_name} - Premium Domain Dropping in ${domain.days_until_drop} Days`;
  const description = `Get ${domain.domain_name} before it expires! Drops in ${domain.days_until_drop} days. Popularity score: ${domain.popularity_score}/100. ${domain.category} domain. Available for backorder on DropCatch and Namecheap.`;

  return {
    title,
    description,
    keywords: [
      domain.domain_name,
      `${domain.domain_name} expiring`,
      `${domain.domain_name} available`,
      `buy ${domain.domain_name}`,
      'expiring domains',
      'domain drop',
      `${domain.tld} domains`,
      domain.category,
      'premium domains',
    ],
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://yourdomain.com/domain/${params.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `https://yourdomain.com/domain/${params.slug}`,
    },
  };
}

/**
 * Get domain by slug
 */
async function getDomainBySlug(slug: string) {
  const { data, error } = await supabase
    .from('domains')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching domain:', error);
    return null;
  }

  return data;
}

/**
 * Get similar domains (same root, different TLDs)
 */
async function getSimilarDomains(domainName: string, currentId: number) {
  const domainRoot = domainName.split('.')[0];

  const { data } = await supabase
    .from('domains')
    .select('*')
    .ilike('domain_name', `${domainRoot}.%`)
    .neq('id', currentId)
    .eq('status', 'pending_delete')
    .limit(5);

  return data || [];
}

/**
 * Generate static params for popular domains (improves build performance)
 */
export async function generateStaticParams() {
  const { data: domains } = await supabase
    .from('domains')
    .select('slug')
    .eq('status', 'pending_delete')
    .gte('popularity_score', 70)
    .limit(50);

  return (domains || []).map((domain) => ({
    slug: domain.slug,
  }));
}

/**
 * Individual domain page
 */
export default async function DomainPage({ params }: PageProps) {
  const domain = await getDomainBySlug(params.slug);

  if (!domain) {
    notFound();
  }

  const similarDomains = await getSimilarDomains(domain.domain_name, domain.id);

  // Track page view
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/track/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain_id: domain.id }),
    });
  } catch (error) {
    // Silent fail - don't break page if tracking fails
  }

  return (
    <>
      {/* JSON-LD Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: domain.domain_name,
            description: `Premium ${domain.category} domain expiring in ${domain.days_until_drop} days`,
            category: 'Domain Name',
            offers: {
              '@type': 'Offer',
              availability: 'https://schema.org/PreOrder',
              price: '59',
              priceCurrency: 'USD',
              url: `https://yourdomain.com/domain/${params.slug}`,
              validFrom: new Date().toISOString(),
              validThrough: domain.drop_date,
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: domain.popularity_score / 20, // Convert to 5-star scale
              bestRating: '5',
              worstRating: '1',
            },
          }),
        }}
      />

      <DomainDetailView domain={domain} similarDomains={similarDomains} />
    </>
  );
}

/**
 * Revalidate every hour to keep data fresh
 */
export const revalidate = 3600;
