require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');
const { execSync } = require('child_process');

AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lambda = new AWS.Lambda();

async function simpleUpdateLambda() {
  const functionName = 'euronext-press-release-automation';
  
  console.log('🚀 Simple Lambda Update with Dependencies\n');
  
  try {
    // Check if Lambda is ready
    console.log('1. Checking Lambda status...');
    const funcInfo = await lambda.getFunction({ FunctionName: functionName }).promise();
    console.log(`Lambda state: ${funcInfo.Configuration.State}`);
    
    if (funcInfo.Configuration.State !== 'Active') {
      console.log('⏳ Waiting for Lambda to be active...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
    
    // Create a simple zip with all dependencies
    console.log('2. Creating complete package...');
    
    // Use the system's zip command for better dependency handling
    execSync('rm -f complete-lambda.zip');
    execSync('zip -r complete-lambda.zip src/ node_modules/ .env package.json -x "node_modules/puppeteer/*" "node_modules/chrome-aws-lambda/*"');
    
    console.log('✅ Package created');
    
    // Update function code
    console.log('3. Updating Lambda function...');
    const zipBuffer = fs.readFileSync('complete-lambda.zip');
    
    await lambda.updateFunctionCode({
      FunctionName: functionName,
      ZipFile: zipBuffer
    }).promise();
    
    // Update configuration
    await lambda.updateFunctionConfiguration({
      FunctionName: functionName,
      Handler: 'src/simple-lambda.handler',
      Environment: {
        Variables: {
          WEBFLOW_API_TOKEN: process.env.WEBFLOW_API_TOKEN,
          WEBFLOW_SITE_ID: process.env.WEBFLOW_SITE_ID,
          WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID,
          DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME,
          AWS_REGION: process.env.AWS_REGION
        }
      }
    }).promise();
    
    console.log('✅ Lambda updated successfully!');
    
    // Wait for update to complete
    console.log('4. Waiting for update to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test the updated function
    console.log('5. Testing updated function...');
    
    const testResult = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify({ action: 'health' }),
      LogType: 'Tail'
    }).promise();
    
    const response = JSON.parse(testResult.Payload);
    console.log('✅ Test result:', JSON.parse(response.body || response));
    
    // Clean up
    fs.unlinkSync('complete-lambda.zip');
    
    return true;
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    return false;
  }
}

simpleUpdateLambda();