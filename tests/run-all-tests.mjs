console.log('========================================================');
console.log('TASKFLOW ENTERPRISE SUITE VERIFICATION TEST RUNNER');
console.log('========================================================\n');

// Ensure server is accessible for integration tests
try {
  const health = await fetch('http://localhost:4000/api/health').catch(() => null);
  if (!health || !health.ok) {
    await import('../server/server.js');
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
} catch (e) {
  // Continue even if pre-launch throws
}

try {
  await import('./workflow.test.mjs');
  await import('./persistence-concurrency.test.mjs');
  await import('./security.test.mjs');
  await import('./backup-restore.test.mjs');
  await import('./dev-console-authority.test.mjs');
  await import('./session-separation.test.mjs');
  await import('./router-urls.test.mjs');
  await import('./test-expanded-tools.mjs');
  await import('./realtime-sync.test.mjs');
  await import('./role-enforcement.test.mjs');
  await import('./detailing-options-and-contextmenu.test.mjs');
  await import('./demo-clean-members-kanban.test.mjs');

  console.log('========================================================');
  console.log('🎉 ALL SUITES PASSED: 100% VERIFICATION CONFIRMED!');
  console.log('========================================================');
  process.exit(0);
} catch (err) {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
}

