import requests
import logging
import time
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
        """Authenticate with the shareholder registry including 2FA"""
        try:
            logger.info("Starting login process...")
            
            # Step 1: Get login page
            login_page = self.session.get(Config.LOGIN_URL)
            login_page.raise_for_status()
            
            soup = BeautifulSoup(login_page.content, 'html.parser')
            
            # Find login form
            login_form = soup.find('form', {'id': 'login-form'}) or soup.find('form')
            if not login_form:
                logger.error("Could not find login form")
                return False
            
            # Build login data
            login_data = {
                'username': Config.REGISTRY_USERNAME,
                'password': Config.REGISTRY_PASSWORD
            }
            
            # Add any hidden fields (CSRF tokens, etc.)
            for hidden_input in soup.find_all('input', type='hidden'):
                name = hidden_input.get('name')
                value = hidden_input.get('value', '')
                if name:
                    login_data[name] = value
            
            # Submit login form
            action = login_form.get('action', '/login/')
            if action.startswith('/'):
                action = f"https://www.aksjeeierregisteret.no{action}"
            
            logger.info("Submitting login credentials...")
            response = self.session.post(action, data=login_data)
            response.raise_for_status()
            
            # Check if we need 2FA
            if 'two factor' in response.text.lower() or 'tofaktor' in response.text.lower():
                logger.info("2FA required. Waiting for code...")
                
                # Get 2FA code from environment or wait for manual input
                twofa_code = Config.TWOFA_CODE
                if not twofa_code:
                    logger.warning("2FA code not provided. Please set TWOFA_CODE environment variable")
                    logger.info("Waiting 30 seconds for manual 2FA completion...")
                    time.sleep(30)  # Wait for manual intervention
                    return self.verify_login()
                
                # Submit 2FA code if provided
                soup = BeautifulSoup(response.content, 'html.parser')
                twofa_form = soup.find('form')
                
                if twofa_form:
                    twofa_data = {'code': twofa_code}
                    
                    # Add hidden fields
                    for hidden in soup.find_all('input', type='hidden'):
                        name = hidden.get('name')
                        if name:
                            twofa_data[name] = hidden.get('value', '')
                    
                    twofa_action = twofa_form.get('action', response.url)
                    if twofa_action.startswith('/'):
                        twofa_action = f"https://www.aksjeeierregisteret.no{twofa_action}"
                    
                    logger.info("Submitting 2FA code...")
                    twofa_response = self.session.post(twofa_action, data=twofa_data)
                    twofa_response.raise_for_status()
                    
                    if self.verify_login():
                        logger.info("Login with 2FA successful")
                        return True
            
            # Check if already logged in
            if self.verify_login():
                logger.info("Login successful")
                return True
            
            logger.error("Login failed - unable to verify session")
            return False
                
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return False
    
    def verify_login(self) -> bool:
        """Verify if we are logged in by checking for logout link or dashboard"""
        try:
            dashboard = self.session.get("https://www.aksjeeierregisteret.no/")
            return 'logout' in dashboard.text.lower() or 'logg ut' in dashboard.text.lower()
        except:
            return False
    
    def navigate_to_protector(self) -> bool:
        """Navigate from dashboard to Protector company page"""
        try:
            logger.info("Navigating to Protector company page...")
            
            # First, go to the dashboard/home page
            dashboard_response = self.session.get("https://www.aksjeeierregisteret.no/")
            dashboard_response.raise_for_status()
            
            # Search for Protector
            search_url = "https://www.aksjeeierregisteret.no/"
            search_data = {
                'companies-search': 'Protector'
            }
            
            # Submit search form
            search_response = self.session.post(search_url, data=search_data)
            
            # Look for the Protector link in search results
            soup = BeautifulSoup(search_response.content, 'html.parser')
            
            # Find the row with Protector (org number: 985279721)
            protector_row = soup.find('tr', {'data-orgnr': '985279721'})
            
            if protector_row:
                # Direct link to Protector page
                protector_url = "https://www.aksjeeierregisteret.no/content/security/?orgnr=985279721"
                logger.info(f"Found Protector, navigating to: {protector_url}")
                return True
            else:
                # Alternative: try direct navigation
                logger.info("Using direct URL to Protector page")
                return True
                
        except Exception as e:
            logger.error(f"Navigation error: {str(e)}")
            return False
    
    def scrape_shareholders(self) -> List[Dict[str, str]]:
        """Scrape top 20 shareholders data"""
        try:
            # Navigate to Protector page
            if not self.navigate_to_protector():
                logger.error("Failed to navigate to Protector page")
                return []
            
            # Make request to Protector shareholders page
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