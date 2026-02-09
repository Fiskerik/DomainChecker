import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import DomainCard from '@/components/DomainCard';
import FilterBar from '@/components/FilterBar';

interface HomeProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function HomePage({ searchParams }: HomeProps) {
  const supabase = createServerComponentClient({ cookies });
  
  let query = supabase
    .from('domains')
    .select('*')
    .neq('current_status', 'dropped')
    .order('popularity_score', { ascending: false })
    .limit(40);

  if (searchParams.tld) {
    query = query.eq('tld', searchParams.tld as string);
  }
  
  if (searchParams.status) {
    query = query.eq('current_status', searchParams.status as string);
  }

  const { data: domains } = await query;

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">DropWatch 🎯</h1>
          <p className="text-gray-500 max-w-md mx-auto">Hitta nästa stora domännamn innan det släpps.</p>
        </header>
        <FilterBar />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {domains?.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>
      </div>
    </main>
  );
}
