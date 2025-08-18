require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lambda = new AWS.Lambda();

async function testLambdaWebflow() {
  const functionName = 'euronext-press-release-automation';
  
  console.log('🔍 Testing Lambda Webflow Integration\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthResult = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify({ action: 'health' }),
      LogType: 'Tail'
    }).promise();
    
    const healthResponse = JSON.parse(healthResult.Payload);
    console.log('Health check response:', JSON.parse(healthResponse.body || '{}'));
    
    // Test 2: Webflow-specific test
    console.log('\n2. Testing Webflow access...');
    const webflowResult = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify({ action: 'test-webflow' }),
      LogType: 'Tail'
    }).promise();
    
    const webflowResponse = JSON.parse(webflowResult.Payload);
    console.log('Webflow test response:', JSON.parse(webflowResponse.body || '{}'));
    
    if (webflowResult.LogResult) {
      const logs = Buffer.from(webflowResult.LogResult, 'base64').toString();
      console.log('\n📋 Webflow test logs:');
      console.log(logs);
    }
    
  } catch (error) {
    console.error('❌ Lambda test failed:', error);
  }
}

testLambdaWebflow();