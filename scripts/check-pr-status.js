#!/usr/bin/env node

/**
 * Manual PR status check script for testing
 * Usage: node scripts/check-pr-status.js [--local-url=http://localhost:3000]
 */

const args = process.argv.slice(2);
const localUrl = args.find(arg => arg.startsWith('--local-url='))?.split('=')[1] || 'http://localhost:3000';

async function checkPRStatus() {
  try {
    console.log('🔍 Checking PR status for all sessions...');

    const response = await fetch(`${localUrl}/api/devin/sessions/pr-status`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('✅ PR Status Check Results:');
    console.log(`   Message: ${data.message}`);
    console.log(`   PRs Checked: ${data.checked}`);
    console.log(`   Sessions Updated: ${data.updated?.length || 0}`);

    if (data.updated && data.updated.length > 0) {
      console.log('\n📝 Updated Sessions:');
      data.updated.forEach(session => {
        console.log(`   - ${session.title} (${session.sessionId})`);
        console.log(`     PR: ${session.prUrl}`);
        console.log(`     Merged: ${session.mergedAt} by ${session.mergedBy}`);
      });
    }

    if (data.prStatuses) {
      const mergedCount = Object.values(data.prStatuses).filter(status => status.merged).length;
      const totalCount = Object.keys(data.prStatuses).length;
      console.log(`\n📊 PR Summary: ${mergedCount}/${totalCount} PRs are merged`);
    }

  } catch (error) {
    console.error('❌ Error checking PR status:', error.message);
    process.exit(1);
  }
}

// Run the check
checkPRStatus();