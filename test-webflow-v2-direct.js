require('dotenv').config();
const axios = require('axios');

async function testWebflowV2Direct() {
  const apiToken = process.env.WEBFLOW_API_TOKEN;
  const siteId = process.env.WEBFLOW_SITE_ID;
  const collectionId = process.env.WEBFLOW_COLLECTION_ID;
  
  console.log('🎯 Testing Webflow v2 API Direct Access\n');
  console.log('Site ID:', siteId);
  console.log('Collection ID:', collectionId);
  console.log('Token length:', apiToken ? apiToken.length : 'No token');
  
  const client = axios.create({
    baseURL: 'https://api.webflow.com',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    // Test 1: List sites (v2)
    console.log('1. Testing v2 sites access...');
    const sitesResponse = await client.get('/v2/sites');
    console.log('✅ Sites access successful!');
    console.log('Sites found:', sitesResponse.data.sites?.length || 0);
    
    // Find our target site
    const targetSite = sitesResponse.data.sites?.find(site => site.id === siteId);
    if (targetSite) {
      console.log('✅ Target site found:', targetSite.displayName);
    } else {
      console.log('❌ Target site not found');
      console.log('Available sites:');
      sitesResponse.data.sites?.forEach(site => {
        console.log(`  - ${site.displayName} (${site.id})`);
      });
      return;
    }

    // Test 2: List collections (v2)
    console.log('\n2. Testing v2 collections access...');
    const collectionsResponse = await client.get(`/v2/sites/${siteId}/collections`);
    console.log('✅ Collections access successful!');
    console.log('Collections found:', collectionsResponse.data.collections?.length || 0);
    
    // Find our target collection
    const targetCollection = collectionsResponse.data.collections?.find(col => col.id === collectionId);
    if (targetCollection) {
      console.log('✅ Target collection found:', targetCollection.displayName);
      console.log('Collection fields:');
      targetCollection.fields?.forEach(field => {
        console.log(`  - ${field.displayName} (${field.slug}) - ${field.type}`);
      });
    } else {
      console.log('❌ Target collection not found');
      console.log('Available collections:');
      collectionsResponse.data.collections?.forEach(col => {
        console.log(`  - ${col.displayName} (${col.id})`);
      });
      return;
    }

    // Test 3: List collection items (v2)
    console.log('\n3. Testing v2 collection items access...');
    const itemsResponse = await client.get(`/v2/sites/${siteId}/collections/${collectionId}/items`);
    console.log('✅ Collection items access successful!');
    console.log('Items found:', itemsResponse.data.items?.length || 0);
    
    if (itemsResponse.data.items?.length > 0) {
      const firstItem = itemsResponse.data.items[0];
      console.log('Sample item:', {
        id: firstItem.id,
        fieldData: Object.keys(firstItem.fieldData || {})
      });
    }

    console.log('\n🎉 All v2 API tests passed! Webflow integration is ready!');
    
  } catch (error) {
    console.error('❌ v2 API test failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
  }
}

testWebflowV2Direct();