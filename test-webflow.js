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
      url: `https://api.webflow.com/v2/sites`,
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });
    
    console.log('✅ Webflow API connection successful!');
    console.log('Sites found:', response.data.sites?.length || 0);
    
    // Find our specific site
    const ourSite = response.data.sites?.find(site => site.id === siteId);
    if (ourSite) {
      console.log('✅ Target site found:', ourSite.displayName);
      console.log('Site ID:', ourSite.id);
      console.log('Workspace:', ourSite.workspaceId);
      return true;
    } else {
      console.log('❌ Target site not found in accessible sites');
      console.log('Available sites:');
      response.data.sites?.forEach(site => {
        console.log(`  - ${site.displayName} (${site.id})`);
      });
      return false;
    }
    
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