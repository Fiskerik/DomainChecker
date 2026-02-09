import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import DomainCard from '@/components/DomainCard';
import FilterBar from '@/components/FilterBar';

export default async function HomePage({ searchParams }) {
  const supabase = createServerComponentClient({ cookies });
  
  // 1. Bygg frågan (query) mot Supabase
  let query = supabase
    .from('domains')
    .select('*')
    // Vi vill bara visa domäner som inte är helt släppta (dropped) än
    .neq('current_status', 'dropped')
    // Sortera efter popularitetspoäng som vi beräknade i ingest-skriptet
    .order('popularity_score', { ascending: false })
    .limit(40);

  // 2. Applicera filter från URL-parametrar om de finns
  if (searchParams.tld) {
    query = query.eq('tld', searchParams.tld);
  }
  
  if (searchParams.status) {
    query = query.eq('current_status', searchParams.status);
  }

  const { data: domains, error } = await query;

  if (error) {
    return <div className="p-8 text-center text-red-500">Kunde inte hämta domäner. Försök igen senare.</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">DropWatch 🎯</h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Hitta nästa stora domännamn innan det släpps. Bevaka dina favoriter och få notiser i rätt tid.
          </p>
        </header>

        {/* Filter-sektion */}
        <FilterBar />
        
        {/* Grid-layout (Pinterest-stil med CSS Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {domains?.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>

        {domains?.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">Inga domäner matchar din sökning just nu.</p>
          </div>
        )}
      </div>
    </main>
  );
}
