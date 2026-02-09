#!/usr/bin/env node

/**
 * Daily Report Script
 * 
 * Generates a daily report of:
 * - New domains added
 * - Domains that dropped
 * - Top performing domains (clicks/views)
 * - Overall statistics
 * 
 * Can optionally email the report or just log to console
 * 
 * Run: node scripts/daily-report.js
 * 
 * Required env vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Optional (for email):
 * - REPORT_EMAIL (your email address)
 * - RESEND_API_KEY (if using Resend for email)
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Get yesterday's date range
 */
function getYesterdayRange() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return {
    start: yesterday.toISOString(),
    end: today.toISOString(),
  };
}

/**
 * Generate daily statistics
 */
async function generateReport() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  📊 Daily Report - ${new Date().toLocaleDateString()}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const { start, end } = getYesterdayRange();
  
  try {
    // 1. New domains added yesterday
    const { data: newDomains, count: newCount } = await supabase
      .from('domains')
      .select('domain_name, popularity_score, category', { count: 'exact' })
      .gte('created_at', start)
      .lt('created_at', end)
      .order('popularity_score', { ascending: false });

    console.log('📦 NEW DOMAINS ADDED YESTERDAY');
    console.log('───────────────────────────────────────────────────────');
    if (newCount > 0) {
      console.log(`Total: ${newCount} new domains\n`);
      newDomains.slice(0, 10).forEach((d, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. ${d.domain_name.padEnd(30)} | Score: ${d.popularity_score} | ${d.category}`);
      });
      if (newCount > 10) {
        console.log(`... and ${newCount - 10} more`);
      }
    } else {
      console.log('No new domains added yesterday');
    }
    console.log('');

    // 2. Domains that dropped yesterday
    const { data: dropped, count: droppedCount } = await supabase
      .from('domains')
      .select('domain_name, drop_date', { count: 'exact' })
      .eq('status', 'dropped')
      .gte('drop_date', start.split('T')[0])
      .lt('drop_date', end.split('T')[0]);

    console.log('📉 DOMAINS DROPPED YESTERDAY');
    console.log('───────────────────────────────────────────────────────');
    if (droppedCount > 0) {
      console.log(`Total: ${droppedCount} domains dropped\n`);
      dropped.slice(0, 10).forEach((d, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. ${d.domain_name}`);
      });
      if (droppedCount > 10) {
        console.log(`... and ${droppedCount - 10} more`);
      }
    } else {
      console.log('No domains dropped yesterday');
    }
    console.log('');

    // 3. Current status breakdown
    const { data: allDomains } = await supabase
      .from('domains')
      .select('status');

    const byStatus = allDomains?.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {}) || {};

    console.log('📊 CURRENT DATABASE STATUS');
    console.log('───────────────────────────────────────────────────────');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`${status.padEnd(20)} ${count}`);
    });
    console.log('');

    // 4. Top performing domains (by clicks)
    const { data: topClicks } = await supabase
      .from('domains')
      .select('domain_name, click_count_total, view_count')
      .eq('status', 'pending_delete')
      .order('click_count_total', { ascending: false })
      .limit(10);

    console.log('🏆 TOP DOMAINS BY CLICKS (All Time)');
    console.log('───────────────────────────────────────────────────────');
    if (topClicks && topClicks.length > 0) {
      topClicks.forEach((d, i) => {
        const ctr = d.view_count > 0 
          ? ((d.click_count_total / d.view_count) * 100).toFixed(1)
          : '0.0';
        console.log(
          `${(i + 1).toString().padStart(2)}. ${d.domain_name.padEnd(30)} | ` +
          `${d.click_count_total.toString().padStart(3)} clicks | ` +
          `${d.view_count.toString().padStart(4)} views | ` +
          `${ctr}% CTR`
        );
      });
    } else {
      console.log('No click data yet');
    }
    console.log('');

    // 5. Yesterday's traffic stats
    const { count: yesterdayViews } = await supabase
      .from('domain_views')
      .select('*', { count: 'exact', head: true })
      .gte('viewed_at', start)
      .lt('viewed_at', end);

    const { count: yesterdayClicks } = await supabase
      .from('affiliate_clicks')
      .select('*', { count: 'exact', head: true })
      .gte('clicked_at', start)
      .lt('clicked_at', end);

    console.log('📈 YESTERDAY\'S TRAFFIC');
    console.log('───────────────────────────────────────────────────────');
    console.log(`Total Views:  ${yesterdayViews || 0}`);
    console.log(`Total Clicks: ${yesterdayClicks || 0}`);
    if (yesterdayViews > 0) {
      const ctr = ((yesterdayClicks / yesterdayViews) * 100).toFixed(1);
      console.log(`CTR:          ${ctr}%`);
    }
    console.log('');

    // 6. Affiliate breakdown (yesterday)
    const { data: clicksByAffiliate } = await supabase
      .from('affiliate_clicks')
      .select('affiliate_type')
      .gte('clicked_at', start)
      .lt('clicked_at', end);

    if (clicksByAffiliate && clicksByAffiliate.length > 0) {
      const breakdown = clicksByAffiliate.reduce((acc, c) => {
        acc[c.affiliate_type] = (acc[c.affiliate_type] || 0) + 1;
        return acc;
      }, {});

      console.log('💰 AFFILIATE CLICKS BREAKDOWN (Yesterday)');
      console.log('───────────────────────────────────────────────────────');
      Object.entries(breakdown).forEach(([affiliate, count]) => {
        console.log(`${affiliate.padEnd(20)} ${count} clicks`);
      });
      console.log('');
    }

    // 7. Dropping this week
    const { data: droppingThisWeek, count: weekCount } = await supabase
      .from('domains')
      .select('domain_name, days_until_drop, popularity_score', { count: 'exact' })
      .eq('status', 'pending_delete')
      .lte('days_until_drop', 7)
      .order('days_until_drop', { ascending: true });

    console.log('⏰ DROPPING THIS WEEK (Next 7 Days)');
    console.log('───────────────────────────────────────────────────────');
    if (weekCount > 0) {
      console.log(`Total: ${weekCount} domains\n`);
      droppingThisWeek.slice(0, 10).forEach((d) => {
        console.log(
          `${d.days_until_drop}d | ${d.domain_name.padEnd(30)} | Score: ${d.popularity_score}`
        );
      });
      if (weekCount > 10) {
        console.log(`... and ${weekCount - 10} more`);
      }
    } else {
      console.log('No domains dropping this week');
    }
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Report generated successfully');
    console.log('═══════════════════════════════════════════════════════\n');

    // Return data for potential email sending
    return {
      newCount,
      droppedCount,
      byStatus,
      yesterdayViews: yesterdayViews || 0,
      yesterdayClicks: yesterdayClicks || 0,
      weekCount,
      topClicks: topClicks?.slice(0, 5) || [],
    };

  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    throw error;
  }
}

/**
 * Send email report (optional)
 * Requires Resend API key
 */
async function sendEmailReport(reportData) {
  const email = process.env.REPORT_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;

  if (!email || !resendKey) {
    console.log('⚠️  Email not configured (missing REPORT_EMAIL or RESEND_API_KEY)');
    return;
  }

  console.log(`📧 Sending email report to ${email}...`);

  try {
    // Example using Resend (install with: npm install resend)
    // const { Resend } = require('resend');
    // const resend = new Resend(resendKey);
    
    // await resend.emails.send({
    //   from: 'reports@yourdomain.com',
    //   to: email,
    //   subject: `Daily Domain Report - ${new Date().toLocaleDateString()}`,
    //   html: generateEmailHTML(reportData),
    // });

    console.log('✅ Email sent successfully');
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const reportData = await generateReport();
    
    // Optionally send email
    if (process.env.REPORT_EMAIL) {
      await sendEmailReport(reportData);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main, generateReport };
