require('dotenv').config();

async function testDynamoDB() {
  console.log('Testing DynamoDB...');
  try {
    const StateManager = require('./src/state-manager');
    const stateManager = new StateManager();
    const result = await stateManager.testConnection();
    console.log('DynamoDB test result:', result);
    return result;
  } catch (error) {
    console.error('DynamoDB test failed:', error.message);
    return false;
  }
}

async function testBusinessHours() {
  console.log('Testing business hours logic...');
  try {
    const PressReleaseOrchestrator = require('./src/orchestrator');
    const orchestrator = new PressReleaseOrchestrator();
    const isBusinessHours = await orchestrator.isBusinessHours();
    console.log('Is business hours:', isBusinessHours);
    return true;
  } catch (error) {
    console.error('Business hours test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Simple Component Tests\n');
  
  const results = {
    dynamodb: await testDynamoDB(),
    businessHours: await testBusinessHours()
  };
  
  console.log('\n📊 Test Results:');
  console.log('DynamoDB:', results.dynamodb ? '✅' : '❌');
  console.log('Business Hours:', results.businessHours ? '✅' : '❌');
  
  const allPassed = Object.values(results).every(r => r);
  console.log('\n🎯 Overall:', allPassed ? '✅ PASS' : '❌ FAIL');
  
  if (allPassed) {
    console.log('\n🚀 Core components are working! Ready for AWS deployment.');
  }
}

main().catch(console.error);