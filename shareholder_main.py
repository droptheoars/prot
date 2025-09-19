#!/usr/bin/env python3
"""
Norwegian Shareholder Registry Scraper
Scrapes top 20 shareholders from aksjeeierregisteret.no and updates Webflow
"""

import logging
import sys
from datetime import datetime
from shareholder_scraper import ShareholderScraper
from shareholder_webflow_api import WebflowAPI
from shareholder_config import Config

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('shareholder-scraper.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

def main():
    """Main execution function"""
    logger.info("=" * 50)
    logger.info(f"Starting shareholder scraper run at {datetime.now()}")
    logger.info("=" * 50)
    
    try:
        # Validate configuration
        Config.validate_config()
        logger.info("Configuration validated successfully")
        
        # Initialize scraper
        scraper = ShareholderScraper()
        
        # Run scraper
        shareholders_data = scraper.run_scraper()
        
        if not shareholders_data:
            logger.error("No data scraped. Exiting.")
            return False
        
        logger.info(f"Successfully scraped {len(shareholders_data)} shareholders")
        
        # Initialize Webflow API
        webflow_api = WebflowAPI()
        
        # Update Webflow with scraped data
        success = webflow_api.update_shareholders(shareholders_data)
        
        if success:
            logger.info("Webflow update completed successfully")
            logger.info("Scraper run completed successfully!")
            return True
        else:
            logger.error("Webflow update failed")
            return False
            
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return False
    finally:
        logger.info("=" * 50)
        logger.info(f"Shareholder scraper run ended at {datetime.now()}")
        logger.info("=" * 50)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)