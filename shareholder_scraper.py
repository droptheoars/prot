import requests
import logging
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from shareholder_config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ShareholderScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': Config.USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })
    
    def login(self) -> bool:
        """Authenticate with the shareholder registry"""
        try:
            # Get login page to retrieve any CSRF tokens or form data
            login_page = self.session.get(Config.LOGIN_URL)
            login_page.raise_for_status()
            
            soup = BeautifulSoup(login_page.content, 'html.parser')
            
            # Find login form and extract any hidden fields
            login_form = soup.find('form')
            if not login_form:
                logger.error("Could not find login form")
                return False
            
            # Build login data
            login_data = {
                'username': Config.REGISTRY_USERNAME,
                'password': Config.REGISTRY_PASSWORD
            }
            
            # Add any hidden form fields (CSRF tokens, etc.)
            for hidden_input in soup.find_all('input', type='hidden'):
                name = hidden_input.get('name')
                value = hidden_input.get('value', '')
                if name:
                    login_data[name] = value
            
            # Submit login form
            action = login_form.get('action', Config.LOGIN_URL)
            if action.startswith('/'):
                action = f"https://www.aksjeeierregisteret.no{action}"
            
            response = self.session.post(action, data=login_data)
            response.raise_for_status()
            
            # Check if login was successful (you may need to adjust this check)
            if 'logout' in response.text.lower() or response.url != Config.LOGIN_URL:
                logger.info("Login successful")
                return True
            else:
                logger.error("Login failed")
                return False
                
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return False
    
    def scrape_shareholders(self) -> List[Dict[str, str]]:
        """Scrape top 20 shareholders data"""
        try:
            # Make authenticated request to target page
            response = self.session.get(Config.TARGET_URL)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find the shareholders table
            shareholders = []
            
            # Look for table rows with investor data
            investor_rows = soup.find_all('tr', id=lambda x: x and x.startswith('investor-'))
            
            logger.info(f"Found {len(investor_rows)} investor rows")
            
            for i, row in enumerate(investor_rows[:Config.MAX_SHAREHOLDERS]):
                try:
                    cells = row.find_all('td')
                    if len(cells) >= 4:  # Ensure we have enough columns
                        
                        # Extract data based on the HTML structure provided
                        surname_company = cells[0].get_text(strip=True) if cells[0] else ''
                        first_name = cells[1].get_text(strip=True) if cells[1] else ''
                        holdings = cells[2].get_text(strip=True) if cells[2] else ''
                        percent = cells[3].get_text(strip=True) if cells[3] else ''
                        
                        # Clean up the data
                        holdings = holdings.replace('\xa0', ' ').replace(',', '').strip()
                        percent = percent.replace('%', '').replace(',', '.').strip()
                        
                        shareholder_data = {
                            'rank': i + 1,
                            'surname_company': surname_company,
                            'first_name': first_name,
                            'holdings': holdings,
                            'percent': percent
                        }
                        
                        shareholders.append(shareholder_data)
                        logger.info(f"Extracted: {shareholder_data}")
                        
                except Exception as e:
                    logger.error(f"Error processing row {i}: {str(e)}")
                    continue
            
            logger.info(f"Successfully scraped {len(shareholders)} shareholders")
            return shareholders
            
        except Exception as e:
            logger.error(f"Scraping error: {str(e)}")
            return []
    
    def run_scraper(self) -> List[Dict[str, str]]:
        """Main scraper workflow"""
        logger.info("Starting shareholder scraper")
        
        # Authenticate
        if not self.login():
            logger.error("Authentication failed")
            return []
        
        # Scrape data
        shareholders = self.scrape_shareholders()
        
        if not shareholders:
            logger.error("No shareholder data extracted")
            return []
        
        logger.info(f"Scraper completed successfully. Extracted {len(shareholders)} shareholders")
        return shareholders