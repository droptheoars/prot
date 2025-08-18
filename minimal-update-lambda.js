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

async function minimalUpdateLambda() {
  const functionName = 'euronext-press-release-automation';
  
  console.log('🎯 Minimal Lambda Update\n');
  
  try {
    console.log('1. Creating minimal package...');
    
    const output = fs.createWriteStream('minimal-lambda.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      // Add only essential files
      archive.file('src/simple-lambda.js', { name: 'src/simple-lambda.js' });
      archive.file('src/webflow-client.js', { name: 'src/webflow-client.js' });
      archive.file('src/state-manager.js', { name: 'src/state-manager.js' });
      archive.file('.env', { name: '.env' });
      archive.file('package.json', { name: 'package.json' });
      
      // Add only the essential node_modules
      const essentialModules = [
        'aws-sdk',
        'axios', 
        'date-fns',
        'date-fns-tz',
        'dotenv',
        'form-data',
        'combined-stream',
        'asynckit',
        'delayed-stream',
        // Add axios dependencies
        'follow-redirects',
        'mime-db',
        'mime-types',
        'proxy-from-env'
      ];
      
      essentialModules.forEach(moduleName => {
        const modulePath = `node_modules/${moduleName}/`;
        if (fs.existsSync(modulePath)) {
          archive.directory(modulePath, `node_modules/${moduleName}/`);
        }
      });

      archive.finalize();
    });

    console.log('✅ Minimal package created');

    // Update function
    console.log('2. Updating Lambda function...');
    const zipBuffer = fs.readFileSync('minimal-lambda.zip');
    
    await lambda.updateFunctionCode({
      FunctionName: functionName,
      ZipFile: zipBuffer
    }).promise();

    console.log('✅ Lambda updated successfully!');
    
    // Wait and test
    console.log('3. Waiting for update...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('4. Testing function...');
    const testResult = await lambda.invoke({
      FunctionName: functionName,
      Payload: JSON.stringify({ action: 'health' }),
      LogType: 'Tail'
    }).promise();
    
    const response = JSON.parse(testResult.Payload);
    console.log('Test result:', JSON.parse(response.body || response));
    
    // Clean up
    fs.unlinkSync('minimal-lambda.zip');
    
    return true;
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    return false;
  }
}

minimalUpdateLambda();