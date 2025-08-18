require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lambda = new AWS.Lambda();
const dynamodb = new AWS.DynamoDB();
const events = new AWS.EventBridge();

async function checkAWSResources() {
  console.log('🔍 Checking AWS Resources Status\n');

  const functionName = 'euronext-press-release-automation';
  const tableName = 'euronext-press-releases-state';
  const ruleName = 'euronext-press-release-schedule';

  // Check DynamoDB table
  try {
    console.log('1. Checking DynamoDB table...');
    const tableInfo = await dynamodb.describeTable({ TableName: tableName }).promise();
    console.log(`✅ DynamoDB table: ${tableInfo.Table.TableStatus}`);
  } catch (error) {
    console.log(`❌ DynamoDB table: ${error.message}`);
  }

  // Check Lambda function
  try {
    console.log('\n2. Checking Lambda function...');
    const funcInfo = await lambda.getFunction({ FunctionName: functionName }).promise();
    console.log(`✅ Lambda function: ${funcInfo.Configuration.State}`);
    console.log(`   Runtime: ${funcInfo.Configuration.Runtime}`);
    console.log(`   Memory: ${funcInfo.Configuration.MemorySize}MB`);
    console.log(`   Timeout: ${funcInfo.Configuration.Timeout}s`);
    console.log(`   Last modified: ${funcInfo.Configuration.LastModified}`);
  } catch (error) {
    console.log(`❌ Lambda function: ${error.message}`);
  }

  // Check EventBridge rule
  try {
    console.log('\n3. Checking EventBridge rule...');
    const ruleInfo = await events.describeRule({ Name: ruleName }).promise();
    console.log(`✅ EventBridge rule: ${ruleInfo.State}`);
    console.log(`   Schedule: ${ruleInfo.ScheduleExpression}`);
  } catch (error) {
    console.log(`❌ EventBridge rule: ${error.message}`);
  }

  // Check EventBridge targets
  try {
    console.log('\n4. Checking EventBridge targets...');
    const targets = await events.listTargetsByRule({ Rule: ruleName }).promise();
    console.log(`✅ EventBridge targets: ${targets.Targets.length} configured`);
    targets.Targets.forEach((target, index) => {
      console.log(`   Target ${index + 1}: ${target.Arn}`);
    });
  } catch (error) {
    console.log(`❌ EventBridge targets: ${error.message}`);
  }

  console.log('\n📋 Summary:');
  console.log('If all resources show ✅, your AWS infrastructure is ready!');
  console.log('If any show ❌, you may need to wait or redeploy.');
}

checkAWSResources().catch(console.error);