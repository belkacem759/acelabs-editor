#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

const version = process.argv[2];

if (!version) {
	console.error('Usage: node scripts/release.js <version>');
	console.error('Example: node scripts/release.js 1.4.10');
	process.exit(1);
}

console.log(`🚀 Preparing release for version ${version}...`);

// Update product.json
console.log('📝 Updating product.json...');
const productJson = JSON.parse(fs.readFileSync('product.json', 'utf8'));
productJson.voidVersion = version;
fs.writeFileSync('product.json', JSON.stringify(productJson, null, '\t'));

// Update package.json
console.log('📝 Updating package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.version = version;
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

// Build the application
console.log('🔨 Building application...');
try {
	execSync('npm run gulp compile', { stdio: 'inherit' });
	console.log('✅ Build completed successfully');
} catch (error) {
	console.log('❌ Build failed:', error.message);
	process.exit(1);
}

// Create git tag
console.log('🏷️  Creating git tag...');
try {
	execSync(`git add .`, { stdio: 'inherit' });
	execSync(`git commit -m "Release version ${version}"`, { stdio: 'inherit' });
	execSync(`git tag v${version}`, { stdio: 'inherit' });
	console.log('✅ Git tag created successfully');
} catch (error) {
	console.error('❌ Git operations failed:', error.message);
	process.exit(1);
}

console.log(`\n🎉 Release ${version} prepared successfully!`);
console.log(`\n📋 Next steps:`);
console.log(`1. Review the changes:`);
console.log(`   git diff`);
console.log(`\n2. Commit and push:`);
console.log(`   git add .`);
console.log(`   git commit -m "Release version ${version}"`);
console.log(`   git push origin main`);
console.log(`\n3. Create and push the tag:`);
console.log(`   git tag v${version}`);
console.log(`   git push origin v${version}`);
console.log(`\n4. GitHub Actions will automatically build and release to:`);
console.log(`   https://github.com/belkacem759/acelabs-editor/releases/tag/v${version}`);

console.log('📋 Summary of changes:');
console.log(`- Updated product.json: voidVersion = ${version}`);
console.log(`- Updated package.json: version = ${version}`);
console.log(`- Created git tag: v${version}`);
