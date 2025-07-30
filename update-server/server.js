const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();

app.use(cors());
app.use(express.json());

// Store latest version info
let latestVersion = {
	version: '1.4.10',
	commit: 'abc123def456',
	timestamp: Date.now()
};

// Update API endpoint that VS Code expects
app.get('/api/update/:platform/:quality/:commit', async (req, res) => {
	const { platform, quality, commit } = req.params;

	console.log(`Update check: platform=${platform}, quality=${quality}, commit=${commit}`);

	// Check if there's a newer version
	if (commit !== latestVersion.commit) {
		const downloadUrl = `https://github.com/aceailabs/acelabs-logs/releases/download/v${latestVersion.version}/void-${platform}-v${latestVersion.version}.zip`;

		res.json({
			version: latestVersion.version,
			productVersion: latestVersion.version,
			url: downloadUrl,
			sha256hash: 'abc123def456...', // You should calculate this
			timestamp: latestVersion.timestamp
		});
	} else {
		res.status(404).json({ error: 'No update available' });
	}
});

// API endpoint for CLI updates
app.get('/api/latest/:platform/:quality', async (req, res) => {
	const { platform, quality } = req.params;

	res.json({
		version: latestVersion.commit,
		name: `Version ${latestVersion.version}`
	});
});

// Admin endpoint to update the latest version
app.post('/admin/update-version', (req, res) => {
	const { version, commit } = req.body;

	if (!version || !commit) {
		return res.status(400).json({ error: 'Version and commit are required' });
	}

	latestVersion = {
		version,
		commit,
		timestamp: Date.now()
	};

	console.log(`Updated latest version to: ${version} (${commit})`);
	res.json({ success: true, latestVersion });
});

// Health check
app.get('/health', (req, res) => {
	res.json({
		status: 'ok',
		latestVersion: latestVersion.version,
		timestamp: new Date().toISOString()
	});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Update server running on port ${PORT}`);
	console.log(`Latest version: ${latestVersion.version} (${latestVersion.commit})`);
});
