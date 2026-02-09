import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { domainId } = await req.json();

  // Kolla om användaren är inloggad
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Logga in först' }, { status: 401 });

  // Kolla om favoriten redan finns
  const { data: existing } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', user.id)
    .eq('domain_id', domainId)
    .single();

  if (existing) {
    // Ta bort om den finns
    await supabase.from('favorites').delete().eq('id', existing.id);
    return NextResponse.json({ status: 'removed' });
  } else {
    // Lägg till om den inte finns
    await supabase.from('favorites').insert({ user_id: user.id, domain_id: domainId });
    return NextResponse.json({ status: 'added' });
  }
}
