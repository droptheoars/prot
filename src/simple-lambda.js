require('dotenv').config();

// Simple Lambda handler for testing Webflow integration without Puppeteer
exports.handler = async (event, context) => {
  console.log('Simple Lambda function started');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Test Webflow connection without Puppeteer
    const WebflowClient = require('./webflow-client');
    const StateManager = require('./state-manager');
    
    const webflowClient = new WebflowClient({
      apiToken: process.env.WEBFLOW_API_TOKEN,
      siteId: process.env.WEBFLOW_SITE_ID,
      collectionId: process.env.WEBFLOW_COLLECTION_ID
    });

    const stateManager = new StateManager({
      tableName: process.env.DYNAMODB_TABLE_NAME,
      region: process.env.AWS_REGION
    });

    let result = {};

    if (event.action === 'health') {
      console.log('Performing health check...');
      
      // Test Webflow connection
      const webflowStatus = await webflowClient.testConnection();
      
      // Test DynamoDB connection  
      const dynamoStatus = await stateManager.testConnection();
      
      result = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: {
          webflow: webflowStatus,
          dynamodb: dynamoStatus
        },
        environment: {
          region: process.env.AWS_REGION,
          hasWebflowToken: !!process.env.WEBFLOW_API_TOKEN,
          hasWebflowSiteId: !!process.env.WEBFLOW_SITE_ID,
          hasWebflowCollectionId: !!process.env.WEBFLOW_COLLECTION_ID
        }
      };
      
    } else if (event.action === 'test-webflow') {
      console.log('Testing Webflow collection operations...');
      
      // Try to get existing collection items
      try {
        const items = await webflowClient.getCollectionItems();
        result = {
          success: true,
          message: 'Successfully connected to Webflow collection',
          itemCount: items.length,
          sampleItems: items.slice(0, 3).map(item => ({
            id: item._id,
            name: item.name,
            date: item.date
          }))
        };
      } catch (error) {
        result = {
          success: false,
          error: error.message,
          webflowTest: 'Failed to access collection items'
        };
      }
      
    } else if (event.action === 'test-create') {
      console.log('Testing creation of sample press release...');
      
      // Create a sample press release item
      const samplePressRelease = {
        id: 'test-' + Date.now(),
        title: 'Test Press Release - ' + new Date().toISOString(),
        company: 'Test Company',
        date: new Date(),
        dateText: new Date().toLocaleDateString(),
        industry: 'Technology',
        topic: 'Testing',
        link: 'https://example.com/test',
        content: {
          text: 'This is a test press release created by the automation system.',
          html: '<p>This is a test press release created by the automation system.</p>'
        }
      };
      
      try {
        const createResult = await webflowClient.createCollectionItem(samplePressRelease);
        await stateManager.markAsProcessed(samplePressRelease, createResult);
        
        result = {
          success: true,
          message: 'Successfully created test press release',
          webflowResult: createResult
        };
      } catch (error) {
        result = {
          success: false,
          error: error.message,
          webflowTest: 'Failed to create test item'
        };
      }
      
    } else {
      result = {
        message: 'Simple Lambda test - Webflow integration only',
        availableActions: ['health', 'test-webflow', 'test-create'],
        environment: 'AWS Lambda',
        note: 'Full scraping functionality requires Puppeteer compatibility fix'
      };
    }

    console.log('Lambda execution completed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Lambda execution failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
};