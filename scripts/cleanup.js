#!/usr/bin/env node

/**
 * Cleanup Script (ES Module Version)
 * 
 * This script:
 * 1. Updates status of all existing domains
 * 2. Marks domains as "dropped" if their drop date has passed
 * 3. Deletes old dropped domains (keeps last 30 days)
 * 4. Cleans up old analytics data (keeps last 90 days)
 * 
 * Run: node scripts/cleanup.js
 * 
 * Required env vars:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Determine status based on expiry date
 */
function determineStatus(expiryDate) {
  const todayUtcMidnight = toUtcMidnight(new Date());
  const expiryUtcMidnight = toUtcMidnight(expiryDate);
  const daysSinceExpiry = Math.round((todayUtcMidnight - expiryUtcMidnight) / (1000 * 60 * 60 * 24));
  
  if (daysSinceExpiry < 0) return 'active';
  if (daysSinceExpiry <= 30) return 'grace';
  if (daysSinceExpiry <= 60) return 'redemption';
  if (daysSinceExpiry <= 75) return 'pending_delete';
  return 'dropped';
}

/**
 * Normalize a date-like value to UTC midnight to avoid timezone drift
 */
function toUtcMidnight(dateInput) {
  const date = new Date(dateInput);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Calculate whole days until drop (date-only, timezone-safe)
 */
function calculateDaysUntilDrop(dropDate) {
  const todayUtcMidnight = toUtcMidnight(new Date());
  const dropUtcMidnight = toUtcMidnight(dropDate);
  return Math.round((dropUtcMidnight - todayUtcMidnight) / (1000 * 60 * 60 * 24));
}

/**
 * Update status of all existing domains
 */
async function updateDomainStatuses() {
  console.log('📊 Updating domain statuses...\n');
  
  try {
    // Fetch all domains that haven't been dropped yet
    const { data: domains, error: fetchError } = await supabase
      .from('domains')
      .select('id, domain_name, expiry_date, drop_date, status, days_until_drop')
      .neq('status', 'dropped');
    
    if (fetchError) {
      console.error('❌ Error fetching domains:', fetchError.message);
      return;
    }
    
    console.log(`   Found ${domains.length} active domains to check\n`);
    
    let updated = 0;
    let statusChanges = {
      'active': 0,
      'grace': 0,
      'redemption': 0,
      'pending_delete': 0,
      'dropped': 0
    };
    
    for (const domain of domains) {
      const newStatus = determineStatus(domain.expiry_date);
      const newDaysUntilDrop = calculateDaysUntilDrop(domain.drop_date);
      
      // Only update if something changed
      if (newStatus !== domain.status || newDaysUntilDrop !== domain.days_until_drop) {
        const { error: updateError } = await supabase
          .from('domains')
          .update({
            status: newStatus,
            days_until_drop: newDaysUntilDrop,
            last_updated: new Date().toISOString()
          })
          .eq('id', domain.id);
        
        if (!updateError) {
          updated++;
          statusChanges[newStatus]++;
          
          if (newStatus === 'dropped') {
            console.log(`   📉 ${domain.domain_name.padEnd(30)} → DROPPED`);
          }
        } else {
          console.error(`   ❌ Error updating ${domain.domain_name}:`, updateError.message);
        }
      }
    }
    
    console.log('\n   ───────────────────────────────────────');
    console.log(`   ✅ Updated ${updated} domains`);
    console.log('   ───────────────────────────────────────');
    console.log('   Status changes:');
    Object.entries(statusChanges).forEach(([status, count]) => {
      if (count > 0) {
        console.log(`      ${status.padEnd(20)} +${count}`);
      }
    });
    console.log('   ───────────────────────────────────────\n');
    
  } catch (error) {
    console.error('❌ Error updating domain statuses:', error.message);
  }
}

/**
 * Delete old dropped domains (keep last 30 days)
 */
async function deleteOldDroppedDomains() {
  console.log('🗑️  Cleaning up old dropped domains...\n');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    const { data: deletedDomains, error } = await supabase
      .from('domains')
      .delete()
      .eq('status', 'dropped')
      .lt('drop_date', cutoffDate)
      .select('domain_name, drop_date');
    
    if (error) {
      console.error('❌ Error deleting old domains:', error.message);
      return;
    }
    
    const count = deletedDomains?.length || 0;
    
    if (count > 0) {
      console.log(`   Deleted ${count} domains that dropped before ${cutoffDate}:`);
      deletedDomains.slice(0, 10).forEach(d => {
        console.log(`      - ${d.domain_name} (dropped ${d.drop_date})`);
      });
      if (count > 10) {
        console.log(`      ... and ${count - 10} more`);
      }
    } else {
      console.log('   No old domains to delete');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Error in cleanup:', error.message);
  }
}

/**
 * Clean up old analytics data (keep last 90 days)
 */
async function cleanupOldAnalytics() {
  console.log('📊 Cleaning up old analytics data...\n');
  
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString();
    
    // Clean up old views
    const { data: deletedViews, error: viewsError } = await supabase
      .from('domain_views')
      .delete()
      .lt('viewed_at', cutoffDate)
      .select('id', { count: 'exact', head: true });
    
    if (viewsError) {
      console.error('   ❌ Error deleting old views:', viewsError.message);
    } else {
      console.log(`   ✅ Deleted old domain views`);
    }
    
    // Clean up old clicks
    const { data: deletedClicks, error: clicksError } = await supabase
      .from('affiliate_clicks')
      .delete()
      .lt('clicked_at', cutoffDate)
      .select('id', { count: 'exact', head: true });
    
    if (clicksError) {
      console.error('   ❌ Error deleting old clicks:', clicksError.message);
    } else {
      console.log(`   ✅ Deleted old affiliate clicks`);
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Error cleaning analytics:', error.message);
  }
}

/**
 * Remove domains no longer in pending_delete (moved to other statuses)
 * This keeps your database focused on the "money zone"
 */
async function removeNonPendingDomains() {
  console.log('🎯 Removing domains no longer in pending_delete phase...\n');
  
  try {
    // Delete domains in grace or redemption (too early)
    const { data: tooEarly, error: earlyError } = await supabase
      .from('domains')
      .delete()
      .in('status', ['grace', 'redemption'])
      .select('domain_name, status');
    
    if (earlyError) {
      console.error('   ❌ Error:', earlyError.message);
    } else if (tooEarly?.length > 0) {
      console.log(`   Removed ${tooEarly.length} domains (too early - still in grace/redemption)`);
    }
    
    const { count: pendingInWindow } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete')
      .gte('days_until_drop', 0)
      .lte('days_until_drop', 10);

    console.log(`   Debug: pending_delete domains currently in 0-10 window: ${pendingInWindow || 0}`);

    // Delete pending_delete domains outside 0-10 day window
    const { data: outsideWindow, error: windowError } = await supabase
      .from('domains')
      .delete()
      .eq('status', 'pending_delete')
      .or('days_until_drop.lt.0,days_until_drop.gt.10')
      .select('domain_name, days_until_drop');
    
    if (windowError) {
      console.error('   ❌ Error:', windowError.message);
    } else if (outsideWindow?.length > 0) {
      console.log(`   Removed ${outsideWindow.length} domains outside 0-10 day window`);
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Error removing non-pending domains:', error.message);
  }
}

/**
 * Display current database stats
 */
async function showStats() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  📊 Current Database Statistics');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // Count by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('domains')
      .select('status', { count: 'exact' });
    
    if (!statusError) {
      const counts = {};
      statusCounts.forEach(d => {
        counts[d.status] = (counts[d.status] || 0) + 1;
      });
      
      console.log('   Domains by status:');
      Object.entries(counts).forEach(([status, count]) => {
        console.log(`      ${status.padEnd(20)} ${count}`);
      });
    }
    
    // Count pending delete
    const { count: pendingCount } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_delete');
    
    console.log('\n   ───────────────────────────────────────');
    console.log(`   🎯 Active pending_delete: ${pendingCount}`);
    console.log('   ───────────────────────────────────────');
    
    // Top domains by clicks
    const { data: topDomains } = await supabase
      .from('domains')
      .select('domain_name, click_count_total, view_count')
      .eq('status', 'pending_delete')
      .order('click_count_total', { ascending: false })
      .limit(5);
    
    if (topDomains?.length > 0) {
      console.log('\n   Top 5 domains by clicks:');
      topDomains.forEach((d, i) => {
        console.log(`      ${(i + 1)}. ${d.domain_name.padEnd(30)} ${d.click_count_total} clicks, ${d.view_count} views`);
      });
    }
    
    console.log('\n═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error fetching stats:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🧹 Domain Cleanup Script');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const startTime = Date.now();
  
  try {
    // 1. Update all domain statuses
    await updateDomainStatuses();
    
    // 2. Remove domains no longer in the "money zone"
    await removeNonPendingDomains();
    
    // 3. Delete old dropped domains
    await deleteOldDroppedDomains();
    
    // 4. Clean up old analytics
    await cleanupOldAnalytics();
    
    // 5. Show current stats
    await showStats();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Cleanup completed in ${duration}s\n`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

export { main };