#!/usr/bin/env python3
"""
Configuration and setup test script for Shareholder Scraper
Tests that all required environment variables are set and dependencies are installed
"""

import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_dependencies():
    """Test that all required packages are installed"""
    try:
        import requests
        import bs4
        import dotenv
        import lxml
        logger.info("✅ All dependencies installed successfully")
        return True
    except ImportError as e:
        logger.error(f"❌ Missing dependency: {e}")
        logger.error("Run: pip install -r shareholder-requirements.txt")
        return False

def test_config():
    """Test configuration setup"""
    try:
        from shareholder_config import Config
        Config.validate_config()
        logger.info("✅ Configuration validated successfully")
        logger.info(f"Target URL: {Config.TARGET_URL}")
        logger.info(f"Max shareholders: {Config.MAX_SHAREHOLDERS}")
        return True
    except Exception as e:
        logger.error(f"❌ Configuration error: {e}")
        logger.error("Check your .env file and ensure all required variables are set")
        return False

def test_modules():
    """Test that all custom modules can be imported"""
    try:
        from shareholder_scraper import ShareholderScraper
        from shareholder_webflow_api import WebflowAPI
        logger.info("✅ All custom modules imported successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Module import error: {e}")
        return False

def main():
    """Run all tests"""
    logger.info("🧪 Running shareholder scraper configuration and setup tests...\n")
    
    tests = [
        ("Dependencies", test_dependencies),
        ("Custom Modules", test_modules), 
        ("Configuration", test_config)
    ]
    
    results = []
    for test_name, test_func in tests:
        logger.info(f"Testing {test_name}...")
        result = test_func()
        results.append(result)
        logger.info("")
    
    if all(results):
        logger.info("🎉 All tests passed! The shareholder scraper is ready to run.")
        logger.info("Next steps:")
        logger.info("1. Provide your credentials in the .env file")
        logger.info("2. Set up GitHub repository secrets")
        logger.info("3. Test with: python shareholder_main.py")
        return True
    else:
        logger.error("❌ Some tests failed. Please fix the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)