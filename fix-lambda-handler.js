require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lambda = new AWS.Lambda();

async function fixLambdaHandler() {
  const functionName = 'euronext-press-release-automation';
  
  console.log('🔧 Fixing Lambda handler configuration...');
  
  try {
    // Just update the handler configuration
    await lambda.updateFunctionConfiguration({
      FunctionName: functionName,
      Handler: 'src/simple-lambda.handler'
    }).promise();

    console.log('✅ Handler updated to src/simple-lambda.handler');
    
    // Wait a moment for the update to propagate
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test the function
    console.log('🧪 Testing updated function...');
    
    const testResult = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify({ action: 'health' }),
      LogType: 'Tail'
    }).promise();
    
    const response = JSON.parse(testResult.Payload);
    console.log('✅ Test result:', response);
    
    if (testResult.LogResult) {
      const logs = Buffer.from(testResult.LogResult, 'base64').toString();
      console.log('\n📋 Function logs:');
      console.log(logs);
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixLambdaHandler();