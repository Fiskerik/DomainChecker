import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
  ];

  // Get all pending delete domains
  const { data: domains } = await supabase
    .from('domains')
    .select('slug, last_updated, popularity_score')
    .eq('status', 'pending_delete')
    .order('popularity_score', { ascending: false });

  // Domain pages
  const domainPages = (domains || []).map((domain) => ({
    url: `${SITE_URL}/domain/${domain.slug}`,
    lastModified: new Date(domain.last_updated),
    changeFrequency: 'hourly' as const,
    priority: domain.popularity_score >= 70 ? 0.9 : 0.7,
  }));

  return [...staticPages, ...domainPages];
}
