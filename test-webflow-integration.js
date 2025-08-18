require('dotenv').config();
const WebflowClient = require('./src/webflow-client');

async function testWebflowIntegration() {
  console.log('🎯 Testing Complete Webflow Integration\n');
  
  try {
    const webflowClient = new WebflowClient({
      apiToken: process.env.WEBFLOW_API_TOKEN,
      siteId: process.env.WEBFLOW_SITE_ID,
      collectionId: process.env.WEBFLOW_COLLECTION_ID
    });

    // Test 1: Connection
    console.log('1. Testing connection...');
    const connectionResult = await webflowClient.testConnection();
    console.log('Connection result:', connectionResult);

    if (!connectionResult) {
      console.log('❌ Connection failed, stopping tests');
      return;
    }

    // Test 2: Get existing items
    console.log('\n2. Testing collection item retrieval...');
    const existingItems = await webflowClient.getCollectionItems();
    console.log(`Found ${existingItems.length} existing items`);

    if (existingItems.length > 0) {
      console.log('Sample item structure:', {
        id: existingItems[0].id,
        fieldData: existingItems[0].fieldData
      });
    }

    // Test 3: Create a sample press release
    console.log('\n3. Testing press release creation...');
    const samplePressRelease = {
      id: 'test-' + Date.now(),
      title: 'Test Press Release - Automation System Test',
      company: 'Protector Forsikring ASA',
      date: new Date(),
      dateText: new Date().toLocaleDateString(),
      industry: 'Insurance',
      topic: 'Testing',
      link: 'https://example.com/test-press-release',
      content: {
        text: 'This is a test press release created by the automation system to verify the integration is working correctly.',
        html: '<p>This is a test press release created by the automation system to verify the integration is working correctly.</p><p>The system can handle rich HTML content and preserve formatting.</p>'
      }
    };

    // Check for duplicates first
    const duplicateId = await webflowClient.checkDuplicate(samplePressRelease);
    if (duplicateId) {
      console.log('✅ Duplicate detection working - found existing item:', duplicateId);
    } else {
      console.log('✅ No duplicate found, proceeding with creation');
    }

    // Create the item
    const createResult = await webflowClient.createCollectionItem(samplePressRelease);
    console.log('Creation result:', createResult);

    if (createResult.success) {
      console.log('✅ Successfully created test press release!');
      console.log('Item ID:', createResult.id);
      console.log('Item slug:', createResult.slug);
    } else {
      console.log('❌ Failed to create test press release:', createResult.error);
    }

    console.log('\n🎉 Webflow integration test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWebflowIntegration();