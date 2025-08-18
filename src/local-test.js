require('dotenv').config();
const PressReleaseOrchestrator = require('./orchestrator');

async function testComponents() {
  console.log('🧪 Testing individual components...\n');

  const orchestrator = new PressReleaseOrchestrator();

  try {
    // Test connections
    console.log('1. Testing connections...');
    const connections = await orchestrator.testConnections();
    console.log('Connection results:', connections);
    
    if (!connections.webflow) {
      console.error('❌ Webflow connection failed');
      return;
    }
    if (!connections.dynamodb) {
      console.error('❌ DynamoDB connection failed');
      return;
    }
    if (!connections.scraper) {
      console.error('❌ Scraper initialization failed');
      return;
    }
    
    console.log('✅ All connections successful\n');

    // Test business hours check
    console.log('2. Testing business hours check...');
    const isBusinessHours = await orchestrator.isBusinessHours();
    console.log(`Business hours: ${isBusinessHours}\n`);

    // Test stats
    console.log('3. Testing stats retrieval...');
    const stats = await orchestrator.getStats();
    console.log('Stats:', JSON.stringify(stats, null, 2));
    console.log('✅ Stats retrieved successfully\n');

    console.log('🎉 All component tests passed!');
    
  } catch (error) {
    console.error('❌ Component test failed:', error);
  }
}

async function testFullRun() {
  console.log('🚀 Testing full orchestrator run...\n');

  const orchestrator = new PressReleaseOrchestrator();

  try {
    const result = await orchestrator.run();
    console.log('Full run result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Full run completed successfully!');
    } else {
      console.log('❌ Full run failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Full run test failed:', error);
  }
}

async function testHealthCheck() {
  console.log('🏥 Testing health check...\n');

  const orchestrator = new PressReleaseOrchestrator();

  try {
    const health = await orchestrator.healthCheck();
    console.log('Health check result:', JSON.stringify(health, null, 2));
    
    if (health.status === 'healthy') {
      console.log('✅ System is healthy!');
    } else {
      console.log('❌ System is unhealthy:', health.error);
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

async function main() {
  console.log('🔧 Euronext Press Release Automation - Local Testing\n');
  console.log('=' .repeat(60));

  const args = process.argv.slice(2);
  const testType = args[0] || 'components';

  switch (testType) {
    case 'components':
      await testComponents();
      break;
    case 'full':
      await testFullRun();
      break;
    case 'health':
      await testHealthCheck();
      break;
    case 'all':
      await testComponents();
      console.log('\n' + '=' .repeat(60) + '\n');
      await testHealthCheck();
      console.log('\n' + '=' .repeat(60) + '\n');
      await testFullRun();
      break;
    default:
      console.log('Usage: node src/local-test.js [components|full|health|all]');
      console.log('  components - Test individual components (default)');
      console.log('  full       - Test full orchestrator run');
      console.log('  health     - Test health check');
      console.log('  all        - Run all tests');
      break;
  }

  console.log('\n🏁 Testing completed');
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    console.error('Main execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testComponents, testFullRun, testHealthCheck };