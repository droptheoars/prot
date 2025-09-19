#!/usr/bin/env python3
"""
Manual 2FA Scraper - For running with manual 2FA input
This script pauses to allow you to manually complete 2FA authentication
"""

import logging
import sys
import time
from datetime import datetime
from shareholder_scraper import ShareholderScraper
from shareholder_webflow_api import WebflowAPI
from shareholder_config import Config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main execution with manual 2FA handling"""
    logger.info("=" * 50)
    logger.info(f"Starting manual 2FA scraper at {datetime.now()}")
    logger.info("=" * 50)
    
    try:
        # Validate configuration
        Config.validate_config()
        logger.info("Configuration validated successfully")
        
        # Initialize scraper
        scraper = ShareholderScraper()
        
        # Attempt login
        logger.info("\n" + "="*50)
        logger.info("IMPORTANT: 2FA AUTHENTICATION REQUIRED")
        logger.info("="*50)
        logger.info("1. The scraper will now attempt to log in")
        logger.info("2. Check your email for the 2FA code")
        logger.info("3. You have 2 options:")
        logger.info("   Option A: Enter the code when prompted below")
        logger.info("   Option B: Complete login manually in browser within 30 seconds")
        logger.info("="*50 + "\n")
        
        # Check if user wants to input 2FA code
        use_manual_code = input("Do you want to enter the 2FA code here? (y/n): ").lower() == 'y'
        
        if use_manual_code:
            twofa_code = input("Enter the 2FA code from your email: ").strip()
            # Temporarily set the 2FA code
            import os
            os.environ['TWOFA_CODE'] = twofa_code
            Config.TWOFA_CODE = twofa_code
        else:
            logger.info("Please complete the 2FA login manually in your browser.")
            logger.info("You have 30 seconds...")
        
        # Run scraper
        if not scraper.login():
            logger.error("Authentication failed. Please check your credentials and try again.")
            return False
        
        # Scrape data
        shareholders_data = scraper.run_scraper()
        
        if not shareholders_data:
            logger.error("No data scraped. Exiting.")
            return False
        
        logger.info(f"Successfully scraped {len(shareholders_data)} shareholders")
        
        # Ask if user wants to update Webflow
        update_webflow = input("\nUpdate Webflow with scraped data? (y/n): ").lower() == 'y'
        
        if update_webflow:
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
        else:
            logger.info("Skipping Webflow update")
            logger.info("Data scraped successfully but not uploaded")
            
            # Display scraped data
            logger.info("\n" + "="*50)
            logger.info("SCRAPED DATA:")
            logger.info("="*50)
            for shareholder in shareholders_data:
                logger.info(f"{shareholder['rank']}. {shareholder['surname_company']} {shareholder['first_name']}")
                logger.info(f"   Holdings: {shareholder['holdings']} ({shareholder['percent']}%)")
            
            return True
            
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        logger.error("Please ensure your .env file has all required values")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return False
    finally:
        logger.info("=" * 50)
        logger.info(f"Scraper run ended at {datetime.now()}")
        logger.info("=" * 50)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)