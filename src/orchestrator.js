const EuronextScraper = require('./euronext-scraper');
const WebflowClient = require('./webflow-client');
const StateManager = require('./state-manager');
const { zonedTimeToUtc, utcToZonedTime, format } = require('date-fns-tz');
const { isWithinInterval, parseISO } = require('date-fns');

class PressReleaseOrchestrator {
  constructor(config = {}) {
    this.config = {
      euronextUrl: config.euronextUrl || process.env.EURONEXT_URL,
      filterDate: config.filterDate || process.env.FILTER_DATE,
      timezone: config.timezone || process.env.NORWAY_TIMEZONE || 'Europe/Oslo',
      businessHoursStart: config.businessHoursStart || process.env.BUSINESS_HOURS_START || '06:00',
      businessHoursEnd: config.businessHoursEnd || process.env.BUSINESS_HOURS_END || '21:00',
      ...config
    };

    this.scraper = new EuronextScraper({
      baseUrl: this.config.euronextUrl,
      filterDate: this.config.filterDate,
      timezone: this.config.timezone
    });

    this.webflowClient = new WebflowClient({
      apiToken: process.env.WEBFLOW_API_TOKEN,
      siteId: process.env.WEBFLOW_SITE_ID,
      collectionId: process.env.WEBFLOW_COLLECTION_ID
    });

    this.stateManager = new StateManager({
      tableName: process.env.DYNAMODB_TABLE_NAME,
      region: process.env.AWS_REGION
    });
  }

  async isBusinessHours() {
    try {
      const now = new Date();
      const norwayTime = utcToZonedTime(now, this.config.timezone);
      const currentHour = format(norwayTime, 'HH:mm', { timeZone: this.config.timezone });
      const currentDay = format(norwayTime, 'EEEE', { timeZone: this.config.timezone });
      
      // Check if it's a weekday (Monday-Friday)
      const isWeekday = !['Saturday', 'Sunday'].includes(currentDay);
      
      // Check if within business hours
      const isWithinHours = currentHour >= this.config.businessHoursStart && currentHour <= this.config.businessHoursEnd;
      
      console.log(`Norway time: ${currentHour} ${currentDay}, Business hours: ${isWeekday && isWithinHours}`);
      
      return isWeekday && isWithinHours;
    } catch (error) {
      console.error('Error checking business hours:', error);
      return true; // Default to running if check fails
    }
  }

  async testConnections() {
    const results = {
      webflow: false,
      dynamodb: false,
      scraper: false
    };

    try {
      console.log('Testing all connections...');

      // Test Webflow connection
      try {
        results.webflow = await this.webflowClient.testConnection();
      } catch (error) {
        console.error('Webflow connection failed:', error);
      }

      // Test DynamoDB connection
      try {
        results.dynamodb = await this.stateManager.testConnection();
      } catch (error) {
        console.error('DynamoDB connection failed:', error);
      }

      // Test scraper (just initialization, no actual scraping)
      try {
        await this.scraper.initialize();
        results.scraper = true;
        await this.scraper.close();
      } catch (error) {
        console.error('Scraper initialization failed:', error);
      }

      console.log('Connection test results:', results);
      return results;
    } catch (error) {
      console.error('Error during connection tests:', error);
      return results;
    }
  }

  async run() {
    const startTime = new Date();
    console.log(`Starting press release monitoring at ${startTime.toISOString()}`);

    const runMetadata = {
      startTime: startTime.toISOString(),
      businessHours: await this.isBusinessHours(),
      success: false,
      error: null,
      results: null
    };

    try {
      // Check if we're in business hours
      if (!runMetadata.businessHours) {
        console.log('Outside business hours, skipping run');
        runMetadata.skipped = true;
        runMetadata.reason = 'outside_business_hours';
        await this.stateManager.saveRunMetadata(runMetadata);
        return { success: true, skipped: true, reason: 'outside_business_hours' };
      }

      // Test connections first
      const connectionResults = await this.testConnections();
      if (!connectionResults.webflow || !connectionResults.dynamodb) {
        throw new Error(`Connection failures: Webflow=${connectionResults.webflow}, DynamoDB=${connectionResults.dynamodb}`);
      }

      // Scrape latest press releases
      console.log('Scraping latest press releases...');
      const allPressReleases = await this.scraper.scrapeLatest();
      console.log(`Scraped ${allPressReleases.length} press releases`);

      if (allPressReleases.length === 0) {
        console.log('No new press releases found');
        runMetadata.success = true;
        runMetadata.results = { found: 0, processed: 0, created: 0, skipped: 0, failed: 0 };
        await this.stateManager.saveRunMetadata(runMetadata);
        return { success: true, results: runMetadata.results };
      }

      // Filter out already processed releases
      const unprocessedReleases = await this.stateManager.filterUnprocessed(allPressReleases);
      console.log(`${unprocessedReleases.length} unprocessed releases found`);

      if (unprocessedReleases.length === 0) {
        console.log('All press releases have already been processed');
        runMetadata.success = true;
        runMetadata.results = { found: allPressReleases.length, processed: 0, created: 0, skipped: allPressReleases.length, failed: 0 };
        await this.stateManager.saveRunMetadata(runMetadata);
        return { success: true, results: runMetadata.results };
      }

      // Process press releases in Webflow
      console.log('Processing press releases in Webflow...');
      const webflowResults = await this.webflowClient.processMultiplePressReleases(unprocessedReleases);

      // Mark all as processed in state manager
      for (let i = 0; i < unprocessedReleases.length; i++) {
        const pressRelease = unprocessedReleases[i];
        const webflowResult = webflowResults.results[i];
        await this.stateManager.markAsProcessed(pressRelease, webflowResult);
      }

      const endTime = new Date();
      const duration = endTime - startTime;

      runMetadata.success = true;
      runMetadata.endTime = endTime.toISOString();
      runMetadata.duration = duration;
      runMetadata.results = {
        found: allPressReleases.length,
        processed: unprocessedReleases.length,
        created: webflowResults.summary.successful,
        skipped: webflowResults.summary.skipped,
        failed: webflowResults.summary.failed
      };

      await this.stateManager.saveRunMetadata(runMetadata);

      console.log(`Run completed successfully in ${duration}ms:`, runMetadata.results);
      
      return {
        success: true,
        results: runMetadata.results,
        duration,
        webflowResults: webflowResults.results
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime - startTime;

      console.error('Run failed:', error);
      
      runMetadata.success = false;
      runMetadata.error = error.message;
      runMetadata.endTime = endTime.toISOString();
      runMetadata.duration = duration;

      await this.stateManager.saveRunMetadata(runMetadata);

      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  async getStats() {
    try {
      const stats = await this.stateManager.getProcessingStats();
      const lastRun = await this.stateManager.getLastRunTime();
      
      return {
        processingStats: stats,
        lastRun: lastRun ? lastRun.toISOString() : null,
        businessHours: await this.isBusinessHours()
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }

  async healthCheck() {
    try {
      const connections = await this.testConnections();
      const stats = await this.getStats();
      
      return {
        status: 'healthy',
        connections,
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = PressReleaseOrchestrator;