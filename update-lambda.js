require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');

AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lambda = new AWS.Lambda();

async function updateLambdaFunction() {
  const functionName = 'euronext-press-release-automation';
  
  console.log('🔄 Updating Lambda function with simple handler...');
  
  try {
    // Wait for Lambda to be ready
    console.log('1. Checking Lambda status...');
    let attempts = 0;
    while (attempts < 10) {
      try {
        const funcInfo = await lambda.getFunction({ FunctionName: functionName }).promise();
        if (funcInfo.Configuration.State === 'Active') {
          console.log('✅ Lambda is ready for update');
          break;
        } else {
          console.log(`⏳ Lambda state: ${funcInfo.Configuration.State}, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
          attempts++;
        }
      } catch (error) {
        console.log(`⏳ Waiting for Lambda to be ready... (attempt ${attempts + 1})`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;
      }
    }
    
    // Package the function
    console.log('2. Creating Lambda package...');
    const output = fs.createWriteStream('simple-lambda.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      // Add source files (exclude problematic Puppeteer)
      archive.file('src/simple-lambda.js', { name: 'src/simple-lambda.js' });
      archive.file('src/webflow-client.js', { name: 'src/webflow-client.js' });
      archive.file('src/state-manager.js', { name: 'src/state-manager.js' });
      archive.file('.env', { name: '.env' });
      archive.file('package.json', { name: 'package.json' });
      
      // Add only essential node_modules
      archive.directory('node_modules/aws-sdk/', 'node_modules/aws-sdk/');
      archive.directory('node_modules/axios/', 'node_modules/axios/');
      archive.directory('node_modules/date-fns/', 'node_modules/date-fns/');
      archive.directory('node_modules/date-fns-tz/', 'node_modules/date-fns-tz/');
      archive.directory('node_modules/dotenv/', 'node_modules/dotenv/');

      archive.finalize();
    });

    console.log('✅ Package created');

    // Update function code
    console.log('3. Updating Lambda function code...');
    const zipBuffer = fs.readFileSync('simple-lambda.zip');

    await lambda.updateFunctionCode({
      FunctionName: functionName,
      ZipFile: zipBuffer
    }).promise();

    // Update function configuration
    console.log('4. Updating Lambda function configuration...');
    await lambda.updateFunctionConfiguration({
      FunctionName: functionName,
      Handler: 'src/simple-lambda.handler',
      Environment: {
        Variables: {
          WEBFLOW_API_TOKEN: process.env.WEBFLOW_API_TOKEN,
          WEBFLOW_SITE_ID: process.env.WEBFLOW_SITE_ID,
          WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID,
          DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME,
          EURONEXT_URL: process.env.EURONEXT_URL,
          FILTER_DATE: process.env.FILTER_DATE,
          NORWAY_TIMEZONE: process.env.NORWAY_TIMEZONE,
          BUSINESS_HOURS_START: process.env.BUSINESS_HOURS_START,
          BUSINESS_HOURS_END: process.env.BUSINESS_HOURS_END
        }
      }
    }).promise();

    console.log('✅ Lambda function updated successfully!');
    
    // Clean up
    fs.unlinkSync('simple-lambda.zip');
    
    // Test the updated function
    console.log('5. Testing updated function...');
    
    const testResult = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify({ action: 'health' })
    }).promise();
    
    const response = JSON.parse(testResult.Payload);
    console.log('Test result:', response);
    
    return true;
    
  } catch (error) {
    console.error('❌ Update failed:', error);
    return false;
  }
}

updateLambdaFunction();