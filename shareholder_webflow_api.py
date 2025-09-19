import requests
import logging
from typing import List, Dict, Optional
from shareholder_config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebflowAPI:
    def __init__(self):
        self.base_url = "https://api.webflow.com"
        self.headers = {
            'Authorization': f'Bearer {Config.WEBFLOW_API_TOKEN}',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    
    def clear_existing_items(self) -> bool:
        """Clear existing shareholder items from Webflow collection"""
        try:
            # Get existing items
            url = f"{self.base_url}/collections/{Config.WEBFLOW_COLLECTION_ID}/items"
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            existing_items = response.json().get('items', [])
            logger.info(f"Found {len(existing_items)} existing items to clear")
            
            # Delete each existing item
            for item in existing_items:
                delete_url = f"{self.base_url}/collections/{Config.WEBFLOW_COLLECTION_ID}/items/{item['_id']}"
                delete_response = requests.delete(delete_url, headers=self.headers)
                if delete_response.status_code == 200:
                    logger.info(f"Deleted item: {item.get('name', item['_id'])}")
                else:
                    logger.warning(f"Failed to delete item {item['_id']}: {delete_response.status_code}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error clearing existing items: {str(e)}")
            return False
    
    def create_shareholder_item(self, shareholder_data: Dict[str, str]) -> Optional[str]:
        """Create a single shareholder item in Webflow"""
        try:
            url = f"{self.base_url}/collections/{Config.WEBFLOW_COLLECTION_ID}/items"
            
            # Map scraper data to Webflow fields
            # Note: You'll need to adjust these field names to match your Webflow collection schema
            webflow_data = {
                'fields': {
                    'name': f"{shareholder_data.get('surname_company', '')} {shareholder_data.get('first_name', '')}".strip(),
                    'surname-company': shareholder_data.get('surname_company', ''),
                    'first-name': shareholder_data.get('first_name', ''),
                    'holdings': shareholder_data.get('holdings', ''),
                    'percentage': shareholder_data.get('percent', ''),
                    'rank': int(shareholder_data.get('rank', 0)),
                    'slug': f"shareholder-{shareholder_data.get('rank', 0)}"  # Auto-generate slug
                }
            }
            
            response = requests.post(url, json=webflow_data, headers=self.headers)
            response.raise_for_status()
            
            result = response.json()
            item_id = result.get('_id')
            
            logger.info(f"Created Webflow item for {webflow_data['fields']['name']}: {item_id}")
            return item_id
            
        except Exception as e:
            logger.error(f"Error creating Webflow item for {shareholder_data}: {str(e)}")
            return None
    
    def publish_site(self) -> bool:
        """Publish the Webflow site to make changes live"""
        try:
            # Note: You'll need to get your site ID from Webflow
            # This is just a placeholder - you'll need to provide the actual site ID
            site_id = "YOUR_SITE_ID"  # Replace with actual site ID
            
            url = f"{self.base_url}/sites/{site_id}/publish"
            publish_data = {
                'domains': ['your-domain.com']  # Replace with your actual domain
            }
            
            response = requests.post(url, json=publish_data, headers=self.headers)
            response.raise_for_status()
            
            logger.info("Site published successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error publishing site: {str(e)}")
            return False
    
    def update_shareholders(self, shareholders_data: List[Dict[str, str]]) -> bool:
        """Update all shareholder data in Webflow"""
        try:
            logger.info("Starting Webflow update process")
            
            # Clear existing items
            if not self.clear_existing_items():
                logger.error("Failed to clear existing items")
                return False
            
            # Create new items
            created_count = 0
            for shareholder in shareholders_data:
                item_id = self.create_shareholder_item(shareholder)
                if item_id:
                    created_count += 1
            
            logger.info(f"Created {created_count} out of {len(shareholders_data)} shareholder items")
            
            # Publish site (optional - you may want to do this manually)
            # self.publish_site()
            
            return created_count == len(shareholders_data)
            
        except Exception as e:
            logger.error(f"Error updating shareholders in Webflow: {str(e)}")
            return False