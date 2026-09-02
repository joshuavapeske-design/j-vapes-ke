/**
 * JVAPES Kenya — Sanity Webhook Listener & Automated Static Pre-Renderer Server
 * Runs as a lightweight microservice on VPS / Node hosting to regenerate static pages upon CMS updates.
 */

const http = require('http');
const { exec } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3005;
const WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET || '';

const server = http.createServer((req, res) => {
    // Health check
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
    }

    // Sanity webhook receiver
    if (req.method === 'POST' && (req.url === '/api/sanity-webhook' || req.url === '/webhook')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            // Optional secret check
            if (WEBHOOK_SECRET && req.headers['x-sanity-webhook-secret'] !== WEBHOOK_SECRET) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Unauthorized: invalid webhook secret' }));
            }

            console.log('⚡ Sanity document mutation received! Triggering static pre-renderer...');

            const scriptPath = path.join(__dirname, 'generate-product-pages.js');
            exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Build failed:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Build failed', details: error.message }));
                }

                console.log('✅ Static build complete:\n', stdout);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'JVAPES product, category & sitemap pages regenerated successfully'
                }));
            });
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
    console.log(`🚀 JVAPES Sanity Webhook Server listening on port ${PORT}`);
    console.log(`📡 Endpoint: http://localhost:${PORT}/api/sanity-webhook`);
});
