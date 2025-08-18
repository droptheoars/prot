require('dotenv').config();
const PressReleaseOrchestrator = require('./orchestrator');

// Lambda handler function
exports.handler = async (event, context) => {
  console.log('Lambda function started');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  // Set longer timeout context
  context.callbackWaitsForEmptyEventLoop = false;

  const orchestrator = new PressReleaseOrchestrator();

  try {
    let result;

    // Handle different event types
    if (event.source === 'aws.events') {
      // Scheduled execution from EventBridge
      console.log('Scheduled execution triggered');
      result = await orchestrator.run();
    } else if (event.httpMethod) {
      // HTTP request (for API Gateway if needed)
      const path = event.path || event.requestContext?.http?.path;
      
      if (path === '/health') {
        result = await orchestrator.healthCheck();
      } else if (path === '/stats') {
        result = await orchestrator.getStats();
      } else if (path === '/run') {
        result = await orchestrator.run();
      } else {
        result = {
          error: 'Unknown endpoint',
          availableEndpoints: ['/health', '/stats', '/run']
        };
      }
    } else if (event.action) {
      // Direct invocation with action
      switch (event.action) {
        case 'run':
          result = await orchestrator.run();
          break;
        case 'health':
          result = await orchestrator.healthCheck();
          break;
        case 'stats':
          result = await orchestrator.getStats();
          break;
        default:
          result = { error: 'Unknown action', availableActions: ['run', 'health', 'stats'] };
      }
    } else {
      // Default to running the main process
      console.log('Default execution triggered');
      result = await orchestrator.run();
    }

    console.log('Execution completed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));

    // Return response for API Gateway
    if (event.httpMethod) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result)
      };
    }

    // Return result for direct invocation or EventBridge
    return result;

  } catch (error) {
    console.error('Lambda execution failed:', error);
    console.error('Stack trace:', error.stack);

    const errorResponse = {
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    // Return error response for API Gateway
    if (event.httpMethod) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(errorResponse)
      };
    }

    // For EventBridge or direct invocation, throw the error
    throw error;
  }
};

// For local testing
if (require.main === module) {
  const testEvent = { action: 'run' };
  const testContext = { 
    functionName: 'test-local',
    functionVersion: '1',
    callbackWaitsForEmptyEventLoop: false
  };

  exports.handler(testEvent, testContext)
    .then(result => {
      console.log('Local test completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Local test failed:', error);
      process.exit(1);
    });
}