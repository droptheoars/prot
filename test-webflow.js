require('dotenv').config();
const axios = require('axios');

async function testWebflowAPI() {
  const apiToken = process.env.WEBFLOW_API_TOKEN;
  const siteId = process.env.WEBFLOW_SITE_ID;
  
  console.log('Testing Webflow API...');
  console.log('Site ID:', siteId);
  console.log('Token length:', apiToken ? apiToken.length : 'No token');
  
  try {
    const response = await axios({
      method: 'GET',
      url: `https://api.webflow.com/sites/${siteId}`,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept-Version': '1.0.0'
      }
    });
    
    console.log('✅ Webflow API connection successful!');
    console.log('Site:', response.data.name);
    console.log('Domain:', response.data.domain);
    
    return true;
  } catch (error) {
    console.error('❌ Webflow API error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    return false;
  }
}

testWebflowAPI();