// Test the GitHub API endpoint that the update system uses
async function testUpdateSystem() {
	console.log('🧪 Testing Update System...\n');

	// Test 1: Check if GitHub API is accessible
	console.log('1. Testing GitHub API accessibility...');
	try {
		const response = await fetch('https://api.github.com/repos/belkacem759/acelabs-editor/releases/latest');
		const data = await response.json();

		if (response.ok) {
			console.log('✅ GitHub API is accessible');
			console.log(`📦 Latest release: ${data.tag_name}`);
			console.log(`📅 Published: ${data.published_at}`);
			console.log(`📝 Description: ${data.body?.substring(0, 100)}...`);
		} else {
			console.log('❌ GitHub API returned error:', data.message);
		}
	} catch (error) {
		console.log('❌ Failed to access GitHub API:', error.message);
	}

	// Test 2: Check current version vs latest
	console.log('\n2. Testing version comparison...');
	const currentVersion = '1.4.9';
	console.log(`📱 Current version: ${currentVersion}`);

	try {
		const response = await fetch('https://api.github.com/repos/belkacem759/acelabs-editor/releases/latest');
		const data = await response.json();

		if (response.ok) {
			const latestVersion = data.tag_name.replace('v', '');
			console.log(`🆕 Latest version: ${latestVersion}`);

			if (latestVersion !== currentVersion) {
				console.log('✅ Update available!');
				console.log(`🔗 Download URL: ${data.html_url}`);
			} else {
				console.log('✅ Already up to date');
			}
		}
	} catch (error) {
		console.log('❌ Failed to check for updates:', error.message);
	}

	// Test 3: Check update URL format
	console.log('\n3. Testing update URL format...');
	const updateUrl = 'https://your-update-server.com';
	const platform = 'darwin';
	const quality = 'stable';
	const commit = '196c3c8ef289f6e9b827bbe3e6a160922163e2bc';

	const expectedUrl = `${updateUrl}/api/update/${platform}/${quality}/${commit}`;
	console.log(`🔗 Expected update URL: ${expectedUrl}`);

	// Test 4: Check download URL format
	console.log('\n4. Testing download URL format...');
	const downloadUrl = 'https://github.com/belkacem759/acelabs-editor/releases/latest';
	console.log(`📥 Download URL: ${downloadUrl}`);

	console.log('\n🎉 Update system test completed!');
	console.log('\n📋 Next steps:');
	console.log('1. Create your first GitHub release to test the update flow');
	console.log('2. Set up your update server at https://your-update-server.com (optional)');
	console.log('3. Test the update flow with your team');
}

testUpdateSystem().catch(console.error);
