const AWS = require('aws-sdk');

class StateManager {
  constructor(config = {}) {
    this.tableName = config.tableName || process.env.DYNAMODB_TABLE_NAME || 'euronext-press-releases-state';
    this.region = config.region || process.env.AWS_REGION || 'us-east-1';
    
    // Configure AWS
    AWS.config.update({
      region: this.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });

    this.dynamodb = new AWS.DynamoDB.DocumentClient();
  }

  async ensureTableExists() {
    try {
      const dynamodb = new AWS.DynamoDB();
      
      // Check if table exists
      try {
        await dynamodb.describeTable({ TableName: this.tableName }).promise();
        console.log(`DynamoDB table ${this.tableName} exists`);
        return true;
      } catch (error) {
        if (error.code !== 'ResourceNotFoundException') {
          throw error;
        }
      }

      // Create table if it doesn't exist
      console.log(`Creating DynamoDB table: ${this.tableName}`);
      
      const tableParams = {
        TableName: this.tableName,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH' // Partition key
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'S'
          }
        ],
        BillingMode: 'PAY_PER_REQUEST' // On-demand pricing
      };

      await dynamodb.createTable(tableParams).promise();
      
      // Wait for table to be created
      await dynamodb.waitFor('tableExists', { TableName: this.tableName }).promise();
      
      console.log(`Table ${this.tableName} created successfully`);
      return true;
      
    } catch (error) {
      console.error('Error ensuring table exists:', error);
      throw error;
    }
  }

  async markAsProcessed(pressRelease, webflowResult = null) {
    try {
      const item = {
        id: pressRelease.id,
        title: pressRelease.title,
        company: pressRelease.company,
        date: pressRelease.date.toISOString(),
        dateText: pressRelease.dateText,
        link: pressRelease.link,
        processedAt: new Date().toISOString(),
        webflowResult: webflowResult,
        ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
      };

      const params = {
        TableName: this.tableName,
        Item: item
      };

      await this.dynamodb.put(params).promise();
      console.log(`Marked as processed: ${pressRelease.title}`);
      
      return true;
    } catch (error) {
      console.error(`Failed to mark as processed: ${pressRelease.title}`, error);
      return false;
    }
  }

  async isAlreadyProcessed(pressReleaseId) {
    try {
      const params = {
        TableName: this.tableName,
        Key: {
          id: pressReleaseId
        }
      };

      const result = await this.dynamodb.get(params).promise();
      
      if (result.Item) {
        console.log(`Already processed: ${pressReleaseId}`);
        return {
          processed: true,
          item: result.Item
        };
      }
      
      return { processed: false };
      
    } catch (error) {
      console.error(`Error checking if processed: ${pressReleaseId}`, error);
      return { processed: false }; // If in doubt, allow processing
    }
  }

  async filterUnprocessed(pressReleases) {
    const unprocessed = [];
    
    console.log(`Checking ${pressReleases.length} press releases for processing status...`);
    
    for (const pr of pressReleases) {
      const status = await this.isAlreadyProcessed(pr.id);
      if (!status.processed) {
        unprocessed.push(pr);
      }
    }
    
    console.log(`${unprocessed.length} unprocessed press releases found`);
    return unprocessed;
  }

  async getProcessingStats() {
    try {
      // Get recent processing stats (last 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const params = {
        TableName: this.tableName,
        FilterExpression: 'processedAt > :weekAgo',
        ExpressionAttributeValues: {
          ':weekAgo': oneWeekAgo.toISOString()
        }
      };

      const result = await this.dynamodb.scan(params).promise();
      
      const stats = {
        totalProcessedLastWeek: result.Items.length,
        successful: result.Items.filter(item => 
          item.webflowResult && item.webflowResult.success
        ).length,
        failed: result.Items.filter(item => 
          item.webflowResult && !item.webflowResult.success
        ).length,
        skipped: result.Items.filter(item => 
          item.webflowResult && item.webflowResult.skipped
        ).length
      };

      return stats;
    } catch (error) {
      console.error('Error getting processing stats:', error);
      return null;
    }
  }

  async saveRunMetadata(metadata) {
    try {
      const item = {
        id: `run-${Date.now()}`,
        type: 'run-metadata',
        timestamp: new Date().toISOString(),
        ...metadata,
        ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
      };

      const params = {
        TableName: this.tableName,
        Item: item
      };

      await this.dynamodb.put(params).promise();
      console.log('Run metadata saved');
      
      return true;
    } catch (error) {
      console.error('Failed to save run metadata:', error);
      return false;
    }
  }

  async getLastRunTime() {
    try {
      const params = {
        TableName: this.tableName,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type'
        },
        ExpressionAttributeValues: {
          ':type': 'run-metadata'
        }
      };

      const result = await this.dynamodb.scan(params).promise();
      
      if (result.Items && result.Items.length > 0) {
        // Sort by timestamp and get the latest
        const latest = result.Items.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        )[0];
        
        return new Date(latest.timestamp);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting last run time:', error);
      return null;
    }
  }

  async cleanup() {
    try {
      console.log('Running cleanup on old records...');
      
      // DynamoDB TTL will handle automatic cleanup
      // This method is a placeholder for any manual cleanup if needed
      
      const stats = await this.getProcessingStats();
      if (stats) {
        console.log('Processing stats:', stats);
      }
      
      return true;
    } catch (error) {
      console.error('Cleanup error:', error);
      return false;
    }
  }

  async testConnection() {
    try {
      console.log('Testing DynamoDB connection...');
      
      await this.ensureTableExists();
      
      // Try to put and get a test item
      const testItem = {
        id: 'test-connection',
        type: 'test',
        timestamp: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 60 // 1 minute TTL
      };

      await this.dynamodb.put({
        TableName: this.tableName,
        Item: testItem
      }).promise();

      const result = await this.dynamodb.get({
        TableName: this.tableName,
        Key: { id: 'test-connection' }
      }).promise();

      if (result.Item) {
        console.log('DynamoDB connection test successful');
        
        // Clean up test item
        await this.dynamodb.delete({
          TableName: this.tableName,
          Key: { id: 'test-connection' }
        }).promise();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('DynamoDB connection test failed:', error);
      return false;
    }
  }
}

module.exports = StateManager;