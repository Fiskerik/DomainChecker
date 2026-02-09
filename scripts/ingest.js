const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function ingestDomains() {
  console.log('🔄 Hämtar utgående domäner...');
  
  try {
    // Exempel-API anrop till WhoisXML API
    const response = await axios.get('https://newly-registered-domains.whoisxmlapi.com/api/v1', {
      params: { apiKey: process.env.WHOIS_API_KEY, mode: 'preview' }
    });

    for (const domain of response.data.domainsList) {
      const expiryDate = new Date(domain.expiresDate);
      const dropDate = new Date(expiryDate);
      dropDate.setDate(dropDate.getDate() + 80); // Beräknat drop-fönster

      // Enkel popularitets-score: Korta namn och specifika TLDs får högre poäng
      let score = 50;
      if (domain.domainName.length < 8) score += 30;
      if (domain.domainName.includes('ai') || domain.domainName.includes('saas')) score += 20;

      await supabase.from('domains').upsert({
        domain_name: domain.domainName,
        tld: domain.domainName.split('.').pop(),
        initial_expiry_date: domain.expiresDate,
        estimated_drop_date: dropDate.toISOString(),
        popularity_score: Math.min(score, 100),
        registrar: domain.registrarName
      }, { onConflict: 'domain_name' });
    }
    console.log('✅ Ingest klar.');
  } catch (err) {
    console.error('❌ Fel vid ingest:', err.message);
  }
}

ingestDomains();
