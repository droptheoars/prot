const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const lambda = new AWS.Lambda();
const dynamodb = new AWS.DynamoDB();
const events = new AWS.EventBridge();
const iam = new AWS.IAM();
const sts = new AWS.STS();
const fs = require('fs');
const path = require('path');

class AWSInfrastructureSetup {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.functionName = 'euronext-press-release-automation';
    this.tableName = process.env.DYNAMODB_TABLE_NAME || 'euronext-press-releases-state';
    this.roleName = 'euronext-lambda-execution-role';
    this.ruleName = 'euronext-press-release-schedule';
  }

  async createDynamoDBTable() {
    try {
      console.log(`Creating DynamoDB table: ${this.tableName}`);
      
      // Check if table exists
      try {
        await dynamodb.describeTable({ TableName: this.tableName }).promise();
        console.log(`✅ Table ${this.tableName} already exists`);
        return true;
      } catch (error) {
        if (error.code !== 'ResourceNotFoundException') {
          throw error;
        }
      }

      const params = {
        TableName: this.tableName,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true
        }
      };

      await dynamodb.createTable(params).promise();
      await dynamodb.waitFor('tableExists', { TableName: this.tableName }).promise();
      
      console.log(`✅ Table ${this.tableName} created successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to create DynamoDB table:`, error);
      throw error;
    }
  }

  async createIAMRole() {
    try {
      console.log(`Creating IAM role: ${this.roleName}`);
      
      // Check if role exists
      try {
        await iam.getRole({ RoleName: this.roleName }).promise();
        console.log(`✅ Role ${this.roleName} already exists`);
        return true;
      } catch (error) {
        if (error.code !== 'NoSuchEntity') {
          throw error;
        }
      }

      // Trust policy for Lambda
      const trustPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }
        ]
      };

      // Create role
      const roleParams = {
        RoleName: this.roleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Description: 'Execution role for Euronext press release automation Lambda'
      };

      await iam.createRole(roleParams).promise();

      // Attach basic Lambda execution policy
      await iam.attachRolePolicy({
        RoleName: this.roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
      }).promise();

      // Create and attach custom policy for DynamoDB
      const dynamoPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:Query',
              'dynamodb:Scan',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem',
              'dynamodb:DescribeTable'
            ],
            Resource: `arn:aws:dynamodb:${this.region}:*:table/${this.tableName}`
          }
        ]
      };

      const policyParams = {
        PolicyName: `${this.roleName}-dynamodb-policy`,
        PolicyDocument: JSON.stringify(dynamoPolicy),
        RoleName: this.roleName
      };

      await iam.putRolePolicy(policyParams).promise();

      console.log(`✅ IAM role ${this.roleName} created successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to create IAM role:`, error);
      throw error;
    }
  }

  async packageLambda() {
    try {
      console.log('📦 Packaging Lambda function...');
      
      const archiver = require('archiver');
      const output = fs.createWriteStream('lambda-package.zip');
      const archive = archiver('zip', { zlib: { level: 9 } });

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          console.log(`✅ Lambda package created: ${archive.pointer()} bytes`);
          resolve();
        });

        archive.on('error', reject);
        archive.pipe(output);

        // Add source files
        archive.directory('src/', 'src/');
        archive.directory('node_modules/', 'node_modules/');
        archive.file('.env', { name: '.env' });
        archive.file('package.json', { name: 'package.json' });

        archive.finalize();
      });
    } catch (error) {
      console.error(`❌ Failed to package Lambda:`, error);
      throw error;
    }
  }

  async createLambdaFunction() {
    try {
      console.log(`Creating Lambda function: ${this.functionName}`);
      
      // Check if function exists
      try {
        await lambda.getFunction({ FunctionName: this.functionName }).promise();
        console.log(`✅ Function ${this.functionName} already exists, updating...`);
        return await this.updateLambdaFunction();
      } catch (error) {
        if (error.code !== 'ResourceNotFoundException') {
          throw error;
        }
      }

      // Package the function
      await this.packageLambda();

      // Get the IAM role ARN
      const role = await iam.getRole({ RoleName: this.roleName }).promise();
      const roleArn = role.Role.Arn;

      // Read the zip file
      const zipBuffer = fs.readFileSync('lambda-package.zip');

      const params = {
        FunctionName: this.functionName,
        Runtime: 'nodejs18.x',
        Role: roleArn,
        Handler: 'src/simple-lambda.handler',
        Code: {
          ZipFile: zipBuffer
        },
        Description: 'Automated Euronext press release monitoring and Webflow publishing',
        Timeout: 900, // 15 minutes
        MemorySize: 1024,
        Environment: {
          Variables: {
            WEBFLOW_API_TOKEN: process.env.WEBFLOW_API_TOKEN,
            WEBFLOW_SITE_ID: process.env.WEBFLOW_SITE_ID,
            WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID,
            DYNAMODB_TABLE_NAME: this.tableName,
            EURONEXT_URL: process.env.EURONEXT_URL,
            FILTER_DATE: process.env.FILTER_DATE,
            NORWAY_TIMEZONE: process.env.NORWAY_TIMEZONE,
            BUSINESS_HOURS_START: process.env.BUSINESS_HOURS_START,
            BUSINESS_HOURS_END: process.env.BUSINESS_HOURS_END
          }
        }
      };

      await lambda.createFunction(params).promise();
      console.log(`✅ Lambda function ${this.functionName} created successfully`);
      
      // Clean up zip file
      fs.unlinkSync('lambda-package.zip');
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to create Lambda function:`, error);
      throw error;
    }
  }

  async updateLambdaFunction() {
    try {
      // Package the function
      await this.packageLambda();

      // Read the zip file
      const zipBuffer = fs.readFileSync('lambda-package.zip');

      // Update function code
      await lambda.updateFunctionCode({
        FunctionName: this.functionName,
        ZipFile: zipBuffer
      }).promise();

      // Update function configuration
      await lambda.updateFunctionConfiguration({
        FunctionName: this.functionName,
        Environment: {
          Variables: {
            WEBFLOW_API_TOKEN: process.env.WEBFLOW_API_TOKEN,
            WEBFLOW_SITE_ID: process.env.WEBFLOW_SITE_ID,
            WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID,
            DYNAMODB_TABLE_NAME: this.tableName,
            EURONEXT_URL: process.env.EURONEXT_URL,
            FILTER_DATE: process.env.FILTER_DATE,
            NORWAY_TIMEZONE: process.env.NORWAY_TIMEZONE,
            BUSINESS_HOURS_START: process.env.BUSINESS_HOURS_START,
            BUSINESS_HOURS_END: process.env.BUSINESS_HOURS_END
          }
        }
      }).promise();

      console.log(`✅ Lambda function ${this.functionName} updated successfully`);
      
      // Clean up zip file
      fs.unlinkSync('lambda-package.zip');
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to update Lambda function:`, error);
      throw error;
    }
  }

  async createEventBridgeRule() {
    try {
      console.log(`Creating EventBridge rule: ${this.ruleName}`);
      
      // Check if rule exists
      try {
        await events.describeRule({ Name: this.ruleName }).promise();
        console.log(`✅ Rule ${this.ruleName} already exists`);
        return true;
      } catch (error) {
        if (error.code !== 'ResourceNotFoundException') {
          throw error;
        }
      }

      // Create rule for every 2 minutes during business hours (6am-9pm Norway time, weekdays)
      // Note: EventBridge uses UTC, so we'll run every 2 minutes and let the Lambda check business hours
      const ruleParams = {
        Name: this.ruleName,
        Description: 'Trigger Euronext press release automation every 2 minutes',
        ScheduleExpression: 'rate(2 minutes)',
        State: 'ENABLED'
      };

      await events.putRule(ruleParams).promise();

      // Get Lambda function ARN
      const lambdaResponse = await lambda.getFunction({ FunctionName: this.functionName }).promise();
      const lambdaArn = lambdaResponse.Configuration.FunctionArn;

      // Add Lambda as target
      const targetParams = {
        Rule: this.ruleName,
        Targets: [
          {
            Id: '1',
            Arn: lambdaArn,
            Input: JSON.stringify({ source: 'aws.events', action: 'run' })
          }
        ]
      };

      await events.putTargets(targetParams).promise();

      // Get AWS account ID
      const identity = await sts.getCallerIdentity().promise();
      const accountId = identity.Account;

      // Add permission for EventBridge to invoke Lambda
      try {
        await lambda.addPermission({
          FunctionName: this.functionName,
          StatementId: 'allow-eventbridge',
          Action: 'lambda:InvokeFunction',
          Principal: 'events.amazonaws.com',
          SourceArn: `arn:aws:events:${this.region}:${accountId}:rule/${this.ruleName}`
        }).promise();
      } catch (error) {
        if (error.code !== 'ResourceConflictException') {
          throw error;
        }
        console.log('Permission already exists');
      }

      console.log(`✅ EventBridge rule ${this.ruleName} created successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to create EventBridge rule:`, error);
      throw error;
    }
  }

  async deployAll() {
    try {
      console.log('🚀 Starting AWS infrastructure deployment...\n');

      // Step 1: Create DynamoDB table
      await this.createDynamoDBTable();
      console.log('');

      // Step 2: Create IAM role
      await this.createIAMRole();
      console.log('');

      // Wait a bit for IAM role to propagate
      console.log('⏳ Waiting for IAM role to propagate...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Step 3: Create Lambda function
      await this.createLambdaFunction();
      console.log('');

      // Step 4: Create EventBridge rule
      await this.createEventBridgeRule();
      console.log('');

      console.log('🎉 AWS infrastructure deployment completed successfully!');
      console.log(`\n📋 Summary:`);
      console.log(`   • DynamoDB Table: ${this.tableName}`);
      console.log(`   • IAM Role: ${this.roleName}`);
      console.log(`   • Lambda Function: ${this.functionName}`);
      console.log(`   • EventBridge Rule: ${this.ruleName}`);
      console.log(`\n🔗 AWS Console Links:`);
      console.log(`   • Lambda: https://${this.region}.console.aws.amazon.com/lambda/home?region=${this.region}#/functions/${this.functionName}`);
      console.log(`   • DynamoDB: https://${this.region}.console.aws.amazon.com/dynamodb/home?region=${this.region}#tables:selected=${this.tableName}`);
      console.log(`   • EventBridge: https://${this.region}.console.aws.amazon.com/events/home?region=${this.region}#/rules`);

      return true;
    } catch (error) {
      console.error('💥 Deployment failed:', error);
      throw error;
    }
  }
}

// Export for programmatic use
module.exports = AWSInfrastructureSetup;

// CLI usage
if (require.main === module) {
  const setup = new AWSInfrastructureSetup();
  
  setup.deployAll()
    .then(() => {
      console.log('\n✅ Deployment script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Deployment script failed:', error);
      process.exit(1);
    });
}