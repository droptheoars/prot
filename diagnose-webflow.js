require('dotenv').config();
const axios = require('axios');

async function diagnoseWebflowAPI() {
  const apiToken = process.env.WEBFLOW_API_TOKEN;
  
  console.log('🔍 Webflow API Diagnosis');
  console.log('========================');
  console.log('Token provided:', !!apiToken);
  console.log('Token length:', apiToken ? apiToken.length : 'No token');
  console.log('Token format:', apiToken ? (apiToken.startsWith('wf_') ? 'Correct format' : 'Unexpected format') : 'No token');
  
  if (!apiToken) {
    console.log('\n❌ No API token found in environment variables.');
    console.log('Please check your .env file and ensure WEBFLOW_API_TOKEN is set.');
    return;
  }

  // Test 1: Try to get user info (basic auth test)
  console.log('\n1. Testing basic authentication...');
  try {
    const response = await axios({
      method: 'GET',
      url: 'https://api.webflow.com/user',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept-Version': '1.0.0'
      }
    });
    
    console.log('✅ Authentication successful!');
    console.log('User:', response.data.user?.firstName, response.data.user?.lastName);
    console.log('Email:', response.data.user?.email);
    
  } catch (error) {
    console.error('❌ Authentication failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    if (error.response?.status === 401) {
      console.log('\n🔧 SOLUTION: Your API token appears to be invalid or expired.');
      console.log('1. Go to https://webflow.com/dashboard/sites/[your-site]/integrations');
      console.log('2. Generate a new API token');
      console.log('3. Make sure it has the required permissions');
      return;
    }
  }

  // Test 2: Try to list sites
  console.log('\n2. Testing sites access...');
  try {
    const response = await axios({
      method: 'GET',
      url: 'https://api.webflow.com/sites',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept-Version': '1.0.0'
      }
    });
    
    console.log('✅ Sites access successful!');
    console.log('Sites found:', response.data.length);
    
    if (response.data.length > 0) {
      console.log('\nAvailable sites:');
      response.data.forEach((site, index) => {
        console.log(`  ${index + 1}. ${site.name} (ID: ${site._id})`);
        console.log(`     Domain: ${site.domain || site.shortName + '.webflow.io'}`);
      });
      
      // Check if our target site exists
      const targetSiteId = process.env.WEBFLOW_SITE_ID;
      const targetSite = response.data.find(site => site._id === targetSiteId);
      
      if (targetSite) {
        console.log(`\n✅ Target site found: ${targetSite.name}`);
      } else {
        console.log(`\n❌ Target site (${targetSiteId}) not found in accessible sites.`);
        console.log('Please verify the WEBFLOW_SITE_ID in your .env file.');
      }
    }
    
  } catch (error) {
    console.error('❌ Sites access failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
  }

  // Test 3: Try v2 API
  console.log('\n3. Testing v2 API access...');
  try {
    const response = await axios({
      method: 'GET',
      url: 'https://api.webflow.com/v2/sites',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });
    
    console.log('✅ v2 API access successful!');
    console.log('Sites found:', response.data.sites?.length || 0);
    
  } catch (error) {
    console.error('❌ v2 API access failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    if (error.response?.data?.message?.includes('missing_scopes')) {
      console.log('\n🔧 SOLUTION: Your API token is missing required scopes.');
      console.log('When creating a new token, make sure to include:');
      console.log('- sites:read');
      console.log('- cms:read');
      console.log('- cms:write');
    }
  }

  console.log('\n📋 Summary and Next Steps:');
  console.log('1. If authentication failed: Generate a new API token');
  console.log('2. If sites access failed: Check token permissions');
  console.log('3. If v2 API failed: Use v1 API endpoints or update token scopes');
  console.log('4. Verify Site ID and Collection ID are correct');
}

diagnoseWebflowAPI();