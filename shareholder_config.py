import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Shareholder registry credentials
    REGISTRY_USERNAME = os.getenv('REGISTRY_USERNAME')
    REGISTRY_PASSWORD = os.getenv('REGISTRY_PASSWORD')
    
    # Target URL
    TARGET_URL = 'https://www.aksjeeierregisteret.no/content/security/?orgnr=985279721&companies-search=protect'
    LOGIN_URL = 'https://www.aksjeeierregisteret.no/login'
    
    # Webflow API
    WEBFLOW_API_TOKEN = os.getenv('WEBFLOW_API_TOKEN')
    WEBFLOW_COLLECTION_ID = os.getenv('WEBFLOW_COLLECTION_ID')
    
    # Scraping settings
    MAX_SHAREHOLDERS = 20
    USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    
    @classmethod
    def validate_config(cls):
        required_vars = [
            'REGISTRY_USERNAME',
            'REGISTRY_PASSWORD', 
            'WEBFLOW_API_TOKEN',
            'WEBFLOW_COLLECTION_ID'
        ]
        
        missing = [var for var in required_vars if not getattr(cls, var)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        return True