require('dotenv').config();
const axios = require('axios');

async function testWebflowV1API() {
  const apiToken = process.env.WEBFLOW_API_TOKEN;
  const siteId = process.env.WEBFLOW_SITE_ID;
  const collectionId = process.env.WEBFLOW_COLLECTION_ID;
  
  console.log('Testing Webflow v1 API...');
  console.log('Site ID:', siteId);
  console.log('Collection ID:', collectionId);
  console.log('Token length:', apiToken ? apiToken.length : 'No token');
  
  // Test 1: Try to get site info with v1 API
  try {
    console.log('\n1. Testing site access with v1 API...');
    const response = await axios({
      method: 'GET',
      url: `https://api.webflow.com/sites/${siteId}`,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept-Version': '1.0.0'
      }
    });
    
    console.log('✅ Site access successful!');
    console.log('Site name:', response.data.name);
    console.log('Site domain:', response.data.domain);
    
  } catch (error) {
    console.error('❌ Site access failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
  }

  // Test 2: Try to get collection info
  try {
    console.log('\n2. Testing collection access...');
    const response = await axios({
      method: 'GET',
      url: `https://api.webflow.com/collections/${collectionId}`,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept-Version': '1.0.0'
      }
    });
    
    console.log('✅ Collection access successful!');
    console.log('Collection name:', response.data.name);
    console.log('Collection fields:', response.data.fields?.map(f => f.name));
    
  } catch (error) {
    console.error('❌ Collection access failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
  }

  // Test 3: Try to get existing collection items
  try {
    console.log('\n3. Testing collection items access...');
    const response = await axios({
      method: 'GET',
      url: `https://api.webflow.com/collections/${collectionId}/items`,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept-Version': '1.0.0'
      }
    });
    
    console.log('✅ Collection items access successful!');
    console.log('Items found:', response.data.items?.length || 0);
    if (response.data.items?.length > 0) {
      const firstItem = response.data.items[0];
      console.log('Sample item fields:', Object.keys(firstItem));
      console.log('Sample item name:', firstItem.name);
    }
    
  } catch (error) {
    console.error('❌ Collection items access failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
  }
}

testWebflowV1API();