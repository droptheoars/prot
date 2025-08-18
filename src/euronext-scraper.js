const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { format, parseISO, isAfter } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');

class EuronextScraper {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://live.euronext.com/en/listview/company-press-release/62020';
    this.filterDate = config.filterDate || '2025-05-12';
    this.timezone = config.timezone || 'Europe/Oslo';
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      console.log('Initializing Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      
      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      // Set longer timeouts for network requests
      await this.page.setDefaultNavigationTimeout(30000);
      await this.page.setDefaultTimeout(30000);
      
      console.log('Puppeteer browser initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async navigateToListPage() {
    try {
      console.log(`Navigating to: ${this.baseUrl}`);
      await this.page.goto(this.baseUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for the table to load
      await this.page.waitForSelector('table', { timeout: 15000 });
      console.log('Successfully loaded press release list page');
      
      return true;
    } catch (error) {
      console.error('Failed to navigate to list page:', error);
      throw error;
    }
  }

  async extractPressReleaseList() {
    try {
      console.log('Extracting press release list...');
      
      // Get the page content
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      const pressReleases = [];
      
      // Find all table rows with press release data
      $('tbody tr').each((index, element) => {
        const $row = $(element);
        const cells = $row.find('td');
        
        if (cells.length >= 5) {
          const dateTimeText = $(cells[0]).text().trim();
          const company = $(cells[1]).text().trim();
          const title = $(cells[2]).text().trim();
          const industry = $(cells[3]).text().trim();
          const topic = $(cells[4]).text().trim();
          
          // Extract the link to the press release
          const linkElement = $(cells[2]).find('a');
          const link = linkElement.attr('href');
          
          if (title && dateTimeText && link) {
            // Parse the date
            const releaseDate = this.parseEuronextDate(dateTimeText);
            
            // Check if this release is after our filter date
            if (releaseDate && this.isAfterFilterDate(releaseDate)) {
              pressReleases.push({
                title: title.trim(),
                company: company.trim(),
                date: releaseDate,
                dateText: dateTimeText,
                industry: industry.trim(),
                topic: topic.trim(),
                link: link.startsWith('/') ? `https://live.euronext.com${link}` : link,
                id: this.generateId(title, dateTimeText, company)
              });
            }
          }
        }
      });
      
      console.log(`Found ${pressReleases.length} press releases after ${this.filterDate}`);
      return pressReleases;
      
    } catch (error) {
      console.error('Failed to extract press release list:', error);
      throw error;
    }
  }

  async extractFullContent(pressRelease) {
    try {
      console.log(`Extracting full content for: ${pressRelease.title}`);
      
      // Navigate to the press release page
      await this.page.goto(pressRelease.link, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait for content to load
      await this.page.waitForSelector('.row.mb-5', { timeout: 15000 });
      
      // Get all elements with class "row mb-5"
      const rowElements = await this.page.$$('.row.mb-5');
      
      if (rowElements.length >= 3) {
        // Extract content from the third "row mb-5" div
        const thirdRowContent = await rowElements[2].evaluate(el => {
          // Get the HTML content while preserving formatting
          return el.innerHTML;
        });
        
        // Clean and format the content
        const cleanContent = this.cleanHtmlContent(thirdRowContent);
        
        return {
          ...pressRelease,
          content: cleanContent,
          rawContent: thirdRowContent
        };
      } else {
        console.warn(`Expected at least 3 "row mb-5" elements, found ${rowElements.length}`);
        
        // Fallback: try to get any content from the page
        const pageContent = await this.page.evaluate(() => {
          const contentDiv = document.querySelector('.container-fluid') || document.querySelector('main') || document.body;
          return contentDiv ? contentDiv.innerHTML : '';
        });
        
        const cleanContent = this.cleanHtmlContent(pageContent);
        
        return {
          ...pressRelease,
          content: cleanContent,
          rawContent: pageContent
        };
      }
      
    } catch (error) {
      console.error(`Failed to extract content for ${pressRelease.title}:`, error);
      
      // Return the press release with basic info if content extraction fails
      return {
        ...pressRelease,
        content: `Content extraction failed. Title: ${pressRelease.title}`,
        rawContent: '',
        extractionError: error.message
      };
    }
  }

  cleanHtmlContent(htmlContent) {
    const $ = cheerio.load(htmlContent);
    
    // Remove script and style tags
    $('script, style').remove();
    
    // Remove empty paragraphs and divs
    $('p:empty, div:empty').remove();
    
    // Clean up whitespace
    $('*').each(function() {
      const text = $(this).text();
      if (text) {
        $(this).text(text.replace(/\\s+/g, ' ').trim());
      }
    });
    
    // Get clean text while preserving basic structure
    const cleanText = $.text().replace(/\\s+/g, ' ').trim();
    
    // Also preserve some HTML structure for rich text
    const preservedHtml = $('body').html() || htmlContent;
    
    return {
      text: cleanText,
      html: preservedHtml
    };
  }

  parseEuronextDate(dateString) {
    try {
      // Euronext format: "16 Aug 2025, 00:14 CEST"
      const regex = /(\\d{1,2})\\s+(\\w{3})\\s+(\\d{4}),\\s+(\\d{2}):(\\d{2})\\s+(\\w+)/;
      const match = dateString.match(regex);
      
      if (match) {
        const [, day, month, year, hour, minute, timezone] = match;
        
        // Convert month name to number
        const monthMap = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        
        const monthNum = monthMap[month];
        if (!monthNum) throw new Error(`Unknown month: ${month}`);
        
        // Create ISO date string
        const isoString = `${year}-${monthNum}-${day.padStart(2, '0')}T${hour}:${minute}:00`;
        const date = parseISO(isoString);
        
        return date;
      }
      
      throw new Error(`Unable to parse date: ${dateString}`);
    } catch (error) {
      console.error(`Date parsing error for "${dateString}":`, error);
      return null;
    }
  }

  isAfterFilterDate(date) {
    try {
      const filterDate = parseISO(this.filterDate);
      return isAfter(date, filterDate);
    } catch (error) {
      console.error('Error comparing dates:', error);
      return false;
    }
  }

  generateId(title, date, company) {
    // Create a unique ID based on title, date, and company
    const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanCompany = company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanDate = date.replace(/[^a-zA-Z0-9]/g, '');
    
    return `${cleanTitle}-${cleanCompany}-${cleanDate}`.substring(0, 100);
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('Browser closed successfully');
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  async scrapeLatest() {
    try {
      await this.initialize();
      await this.navigateToListPage();
      
      const pressReleases = await this.extractPressReleaseList();
      
      // Extract full content for each press release
      const fullPressReleases = [];
      for (const pr of pressReleases) {
        const fullPr = await this.extractFullContent(pr);
        fullPressReleases.push(fullPr);
        
        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      return fullPressReleases;
      
    } catch (error) {
      console.error('Scraping failed:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

module.exports = EuronextScraper;