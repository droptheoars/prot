const axios = require('axios');
const { format } = require('date-fns');

class WebflowClient {
  constructor(config = {}) {
    this.apiToken = config.apiToken || process.env.WEBFLOW_API_TOKEN;
    this.siteId = config.siteId || process.env.WEBFLOW_SITE_ID;
    this.collectionId = config.collectionId || process.env.WEBFLOW_COLLECTION_ID;
    this.baseUrl = 'https://api.webflow.com';
    
    if (!this.apiToken) {
      throw new Error('Webflow API token is required');
    }
    if (!this.siteId) {
      throw new Error('Webflow Site ID is required');
    }
    if (!this.collectionId) {
      throw new Error('Webflow Collection ID is required');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Add rate limiting
    this.lastRequestTime = 0;
    this.requestDelay = 1000; // 1 second between requests to stay under 60/minute limit
  }

  async makeRequest(method, url, data = null) {
    try {
      // Rate limiting - ensure at least 1 second between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.requestDelay) {
        const delay = this.requestDelay - timeSinceLastRequest;
        console.log(`Rate limiting: waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      this.lastRequestTime = Date.now();

      const config = {
        method,
        url
      };

      // Only add data for POST/PUT requests
      if (data && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put')) {
        config.data = data;
      }

      console.log(`Making ${method.toUpperCase()} request to: ${url}`);
      const response = await this.client(config);
      
      return response.data;
    } catch (error) {
      console.error(`Webflow API Error:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: url
      });
      
      if (error.response?.status === 429) {
        console.log('Rate limit exceeded, waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        return this.makeRequest(method, url, data); // Retry after waiting
      }
      
      throw error;
    }
  }

  async getCollectionItems() {
    try {
      console.log('Fetching existing collection items...');
      const url = `/v2/sites/${this.siteId}/collections/${this.collectionId}/items`;
      const response = await this.makeRequest('GET', url);
      
      console.log(`Found ${response.items?.length || 0} existing items`);
      return response.items || [];
    } catch (error) {
      console.error('Failed to fetch collection items:', error);
      throw error;
    }
  }

  async checkDuplicate(pressRelease) {
    try {
      const existingItems = await this.getCollectionItems();
      
      // Check for duplicates based on title and date (v2 API format)
      const duplicate = existingItems.find(item => {
        const titleMatch = item.fieldData?.name === pressRelease.title;
        const dateMatch = item.fieldData?.['date-2'] && new Date(item.fieldData['date-2']).toDateString() === pressRelease.date.toDateString();
        return titleMatch && dateMatch;
      });

      if (duplicate) {
        console.log(`Duplicate found for: ${pressRelease.title}`);
        return duplicate.id;
      }

      return null;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return null; // Continue with creation if duplicate check fails
    }
  }

  formatContentForWebflow(pressRelease) {
    try {
      // Generate a URL-friendly slug
      const slug = pressRelease.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

      // Format the date for Webflow (ISO string)
      const formattedDate = pressRelease.date.toISOString();

      // Prepare content for rich text field
      let content = '';
      if (pressRelease.content) {
        if (typeof pressRelease.content === 'object') {
          // Use HTML content if available, otherwise text
          content = pressRelease.content.html || pressRelease.content.text || '';
        } else {
          content = pressRelease.content;
        }
      }

      // Create read more link
      const readMoreLink = pressRelease.link || '';

      // Based on the actual Webflow collection fields from API:
      // - name (required)
      // - slug (required) 
      // - date-2 (Date/Time)
      // - pm-body-html (Rich text)
      // - read-more-link (Link)
      
      const webflowItem = {
        isArchived: false,
        isDraft: true, // Create as draft initially for safety
        fieldData: {
          name: pressRelease.title,
          slug: slug,
          'date-2': formattedDate,
          'pm-body-html': content,
          'read-more-link': readMoreLink
        }
      };

      console.log('Formatted item for Webflow:', {
        name: webflowItem.fieldData.name,
        slug: webflowItem.fieldData.slug,
        date: webflowItem.fieldData['date-2'],
        contentLength: content.length,
        readMoreLink: readMoreLink
      });

      return webflowItem;
    } catch (error) {
      console.error('Error formatting content for Webflow:', error);
      throw error;
    }
  }

  async createCollectionItem(pressRelease) {
    try {
      console.log(`Creating Webflow item for: ${pressRelease.title}`);

      // Check for duplicates first
      const duplicateId = await this.checkDuplicate(pressRelease);
      if (duplicateId) {
        console.log(`Skipping duplicate item: ${pressRelease.title}`);
        return { skipped: true, duplicateId, title: pressRelease.title };
      }

      // Format the press release for Webflow
      const webflowItem = this.formatContentForWebflow(pressRelease);

      // Create the item
      const url = `/v2/sites/${this.siteId}/collections/${this.collectionId}/items`;
      const response = await this.makeRequest('POST', url, webflowItem);

      console.log(`Successfully created item: ${pressRelease.title} (ID: ${response.id})`);
      
      return {
        success: true,
        id: response.id,
        title: pressRelease.title,
        slug: webflowItem.fieldData.slug
      };

    } catch (error) {
      console.error(`Failed to create item for ${pressRelease.title}:`, error);
      
      return {
        success: false,
        error: error.message,
        title: pressRelease.title
      };
    }
  }

  async publishItem(itemId) {
    try {
      console.log(`Publishing item: ${itemId}`);
      
      const url = `/v2/sites/${this.siteId}/collections/${this.collectionId}/items/${itemId}/publish`;
      await this.makeRequest('PUT', url);
      
      console.log(`Successfully published item: ${itemId}`);
      return true;
    } catch (error) {
      console.error(`Failed to publish item ${itemId}:`, error);
      return false;
    }
  }

  async publishSite() {
    try {
      console.log('Publishing site...');
      
      const url = `/v2/sites/${this.siteId}/publish`;
      const response = await this.makeRequest('POST', url, { publishToWebflowSubdomain: true });
      
      console.log('Site publish initiated successfully');
      return response;
    } catch (error) {
      console.error('Failed to publish site:', error);
      throw error;
    }
  }

  async processMultiplePressReleases(pressReleases) {
    const results = [];
    
    console.log(`Processing ${pressReleases.length} press releases...`);
    
    for (const pressRelease of pressReleases) {
      try {
        const result = await this.createCollectionItem(pressRelease);
        results.push(result);
        
        // Add delay between items to respect rate limits
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        
      } catch (error) {
        console.error(`Failed to process ${pressRelease.title}:`, error);
        results.push({
          success: false,
          error: error.message,
          title: pressRelease.title
        });
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success && !r.skipped).length;

    console.log(`Processing complete: ${successful} created, ${skipped} skipped (duplicates), ${failed} failed`);

    return {
      results,
      summary: {
        total: pressReleases.length,
        successful,
        skipped,
        failed
      }
    };
  }

  async testConnection() {
    try {
      console.log('Testing Webflow connection...');
      
      // Use v2 API directly
      const url = `/v2/sites`;
      const response = await this.makeRequest('GET', url);
      
      console.log(`Connected to Webflow v2! Found ${response.sites?.length || 0} sites`);
      
      // Find our specific site
      const ourSite = response.sites?.find(site => site.id === this.siteId);
      if (ourSite) {
        console.log(`Target site found: ${ourSite.displayName}`);
        return true;
      } else {
        console.warn(`Site ${this.siteId} not found in accessible sites`);
        console.log('Available sites:', response.sites?.map(s => `${s.displayName} (${s.id})`));
        return false;
      }
    } catch (error) {
      console.error('Webflow connection test failed:', error);
      return false;
    }
  }
}

module.exports = WebflowClient;