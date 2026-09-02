const fs = require('fs');
const path = require('path');

console.log('🔍 Starting JVAPES V2 Automated SEO Verification Suite...\n');

let totalErrors = 0;
let totalWarnings = 0;
let totalPassed = 0;

function pass(msg) {
    console.log(`  ✅ ${msg}`);
    totalPassed++;
}

function warn(msg) {
    console.log(`  ⚠️ ${msg}`);
    totalWarnings++;
}

function fail(msg) {
    console.log(`  ❌ ${msg}`);
    totalErrors++;
}

// 1. Verify robots.txt
console.log('1️⃣ Auditing robots.txt...');
const robotsPath = path.join(__dirname, '../robots.txt');
if (fs.existsSync(robotsPath)) {
    const robotsTxt = fs.readFileSync(robotsPath, 'utf8');
    if (robotsTxt.includes('Sitemap: https://jvapes.store/sitemap.xml')) {
        pass('robots.txt correctly declares sitemap.xml link.');
    } else {
        fail('robots.txt is missing sitemap reference.');
    }
} else {
    fail('robots.txt file is missing.');
}

// 2. Verify sitemap.xml
console.log('\n2️⃣ Auditing sitemap.xml...');
const sitemapPath = path.join(__dirname, '../sitemap.xml');
if (fs.existsSync(sitemapPath)) {
    const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
    const locMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g) || [];
    pass(`sitemap.xml exists and contains ${locMatches.length} total URLs.`);

    let validUrls = 0;
    locMatches.forEach(m => {
        const url = m.replace('<loc>', '').replace('</loc>', '');
        if (url.startsWith('https://jvapes.store/')) {
            validUrls++;
        } else {
            fail(`Invalid sitemap URL domain: ${url}`);
        }
    });

    if (validUrls === locMatches.length && locMatches.length > 0) {
        pass(`All ${locMatches.length} URLs use canonical https://jvapes.store domain.`);
    }
} else {
    fail('sitemap.xml file is missing.');
}

// 3. Audit Static HTML Pages for Metadata & JSON-LD
console.log('\n3️⃣ Auditing HTML Metadata & Structured Data...');
const rootDir = path.join(__dirname, '..');
const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
    const filePath = path.join(rootDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Title tag check
    const titleMatch = content.match(/<title>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1].trim().length > 0) {
        pass(`${file} has valid title: "${titleMatch[1].trim()}"`);
    } else {
        fail(`${file} is missing <title> tag.`);
    }

    // Meta description check
    const metaDescMatch = content.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    if (metaDescMatch && metaDescMatch[1].trim().length > 0) {
        pass(`${file} has meta description (${metaDescMatch[1].trim().length} chars).`);
    } else {
        fail(`${file} is missing meta description.`);
    }

    // Canonical tag check (except 404.html)
    if (file !== '404.html') {
        const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i);
        if (canonicalMatch && canonicalMatch[1].startsWith('https://jvapes.store/')) {
            pass(`${file} has canonical URL: ${canonicalMatch[1]}`);
        } else {
            fail(`${file} has invalid or missing canonical tag.`);
        }
    }

    // JSON-LD validation
    const jsonLdBlocks = content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
    jsonLdBlocks.forEach((block, i) => {
        const jsonStr = block.replace(/<script type="application\/ld\+json">/i, '').replace(/<\/script>/i, '').trim();
        try {
            const parsed = JSON.parse(jsonStr);
            if (parsed['@context'] && parsed['@type']) {
                pass(`${file} JSON-LD block #${i + 1} (${parsed['@type']}) parsed successfully.`);
            } else {
                warn(`${file} JSON-LD block #${i + 1} missing @context or @type.`);
            }
        } catch (e) {
            fail(`${file} JSON-LD block #${i + 1} has invalid JSON syntax: ${e.message}`);
        }
    });

    // Image alt text check
    const imgMatches = content.match(/<img\s+[^>]*>/gi) || [];
    imgMatches.forEach(img => {
        if (!img.includes('alt=')) {
            warn(`${file} has <img> tag missing alt attribute.`);
        }
    });
});

console.log('\n==========================================');
console.log(`📊 SEO Audit Summary: ${totalPassed} PASSED, ${totalWarnings} WARNINGS, ${totalErrors} ERRORS.`);
console.log('==========================================\n');

if (totalErrors > 0) {
    process.exit(1);
} else {
    console.log('🎉 Technical SEO Verification Passed Successfully!');
    process.exit(0);
}
