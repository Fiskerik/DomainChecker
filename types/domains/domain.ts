// types/domain.ts

export type DomainStatus = 'active' | 'grace' | 'redemption' | 'pending_delete' | 'dropped';
export type ViewMode = 'card' | 'list';

export interface Domain {
  id: string;
  domain_name: string;
  slug: string;
  tld: string;
  expiry_date: string;
  drop_date: string;
  days_until_drop: number;
  popularity_score: number;
  category: string;
  status: DomainStatus | string; // Allow string for flexibility
  registrar?: string;
  estimated_value?: string;
  title?: string;
  view_count?: number;
  click_count_total?: number;
  metadata?: {
    nameQuality?: number;
    trendingWords?: number;
    historicalValue?: number;
    technicalMetrics?: number;
    badges?: string[];
    reasoning?: string;
  };
  last_updated?: string;
  created_at?: string;
}

export interface DomainFilters {
  status_mode?: 'exclude_pending_delete' | 'all' | 'pending_delete' | 'grace' | 'redemption' | 'dropped';
  tld?: string;
  category?: string;
  min_score?: number;
  max_score?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface DomainStats {
  total_pending: number;
  hot_domains: number;
  dropping_this_week: number;
  by_tld?: Record<string, number>;
  last_updated?: string;
}