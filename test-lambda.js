require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lambda = new AWS.Lambda();

async function testLambdaFunction() {
  const functionName = 'euronext-press-release-automation';
  
  console.log('🚀 Testing Lambda Function\n');
  
  try {
    console.log('1. Testing health check...');
    const healthPayload = {
      action: 'health'
    };
    
    const healthResult = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify(healthPayload),
      LogType: 'Tail'
    }).promise();
    
    const healthResponse = JSON.parse(healthResult.Payload);
    console.log('Health check result:', healthResponse);
    
    if (healthResult.LogResult) {
      const logs = Buffer.from(healthResult.LogResult, 'base64').toString();
      console.log('\nHealth check logs:');
      console.log(logs);
    }
    
    console.log('\n2. Testing full press release run...');
    const runPayload = {
      action: 'run'
    };
    
    const runResult = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify(runPayload),
      LogType: 'Tail'
    }).promise();
    
    const runResponse = JSON.parse(runResult.Payload);
    console.log('Run result:', runResponse);
    
    if (runResult.LogResult) {
      const logs = Buffer.from(runResult.LogResult, 'base64').toString();
      console.log('\nRun logs:');
      console.log(logs);
    }
    
  } catch (error) {
    console.error('❌ Lambda test failed:', error);
  }
}

testLambdaFunction();