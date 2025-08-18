require('dotenv').config();
const PressReleaseOrchestrator = require('./orchestrator');

// Main entry point for the application
async function main() {
  console.log('🚀 Euronext Press Release Automation Starting...');
  
  const orchestrator = new PressReleaseOrchestrator();
  
  try {
    const result = await orchestrator.run();
    
    if (result.success) {
      console.log('✅ Process completed successfully');
      if (result.results) {
        console.log(`📊 Results: ${result.results.created} created, ${result.results.skipped} skipped, ${result.results.failed} failed`);
      }
    } else {
      console.error('❌ Process failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { main };