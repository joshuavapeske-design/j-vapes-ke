const fs = require('fs');
const path = require('path');
const https = require('https');

const SANITY_PROJECT_ID = 'pkrx1c35';
const SANITY_DATASET = 'production';
const SANITY_API_VERSION = 'v2021-10-21';
const SANITY_URL = `https://${SANITY_PROJECT_ID}.api.sanity.io/${SANITY_API_VERSION}/data/query/${SANITY_DATASET}`;
const BASE_URL = 'https://jvapes.store';

function slugify(text) {
    if (!text) return 'product';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function getSanityImageUrl(imageObj) {
    if (!imageObj || !imageObj.asset || !imageObj.asset._ref) {
        return `${BASE_URL}/favicon.png`;
    }
    const assetRef = imageObj.asset._ref;
    const cleanId = assetRef.replace(/^image-/, '');
    const lastHyphenIndex = cleanId.lastIndexOf('-');
    if (lastHyphenIndex !== -1) {
        const base = cleanId.substring(0, lastHyphenIndex);
        const ext = cleanId.substring(lastHyphenIndex + 1);
        return `https://cdn.sanity.io/images/${SANITY_PROJECT_ID}/${SANITY_DATASET}/${base}.${ext}`;
    }
    return `${BASE_URL}/favicon.png`;
}

function fetchSanityData(query) {
    return new Promise((resolve, reject) => {
        const url = `${SANITY_URL}?query=${encodeURIComponent(query)}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.result || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => reject(err));
    });
}

function renderDescription(desc) {
    if (!desc) return '<p>Premium authentic vape hardware and electronic nicotine device engineered for clean taste and reliable performance. Available for fast dispatch in Ruiru and Nairobi.</p>';
    if (typeof desc === 'string') return `<p>${desc}</p>`;
    if (Array.isArray(desc)) {
        return desc.map(block => {
            if (block._type === 'block' && block.children) {
                const text = block.children.map(c => c.text || '').join('');
                return `<p>${text}</p>`;
            }
            return '';
        }).filter(Boolean).join('');
    }
    return '<p>Genuine electronic vape hardware with same-day delivery.</p>';
}

async function generate() {
    console.log('🚀 Starting JVAPES Static Product Page & Sitemap Pre-Renderer...');

    const templatePath = path.join(__dirname, '../templates/product-template.html');
    if (!fs.existsSync(templatePath)) {
        console.error('❌ Template not found:', templatePath);
        return;
    }
    const template = fs.readFileSync(templatePath, 'utf8');

    const outputDir = path.join(__dirname, '../product');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const groqQuery = `*[_type == "product"]{
        _id,
        name,
        slug,
        brand,
        price,
        stock,
        sku,
        productType,
        category->{
            name,
            slug
        },
        flavors,
        image,
        description,
        puffs,
        seoTitle,
        metaDescription,
        canonicalUrl,
        ogTitle,
        ogDescription,
        ogImage,
        noIndex
    }`;

    let products = [];
    try {
        products = await fetchSanityData(groqQuery);
        console.log(`✅ Successfully fetched ${products.length} products from Sanity.`);
    } catch (err) {
        console.warn('⚠️ Could not connect to live Sanity API during build:', err.message);
    }

    const generatedUrls = [];
    const seenSlugs = new Map();

    products.forEach((p) => {
        let baseSlug = (p.slug && p.slug.current) ? p.slug.current : slugify(p.name || 'item');
        let slug = baseSlug;
        if (seenSlugs.has(baseSlug)) {
            const count = seenSlugs.get(baseSlug) + 1;
            seenSlugs.set(baseSlug, count);
            slug = `${baseSlug}-${count}`;
        } else {
            seenSlugs.set(baseSlug, 1);
        }
        p.assignedSlug = slug;

        const prodName = p.name || 'Vape Device';
        const brand = p.brand || 'JVAPES';
        const price = Number(p.price || 0);
        const formattedPrice = price.toLocaleString('en-KE');
        const imageUrl = getSanityImageUrl(p.image);
        const isOutOfStock = (p.stock === 0 || p.stock === undefined);

        const pageTitle = p.seoTitle || `${prodName} by ${brand} | JVAPES Kenya — Buy in Ruiru & Nairobi`;
        const metaDesc = p.metaDescription || `Buy genuine ${prodName} in Kenya for KES ${formattedPrice}. Same-day delivery in Ruiru & Nairobi, pay on delivery via M-Pesa. 18+ only.`;
        const canonicalUrl = p.canonicalUrl || `${BASE_URL}/product/${slug}.html`;
        const robots = p.noIndex ? 'noindex, nofollow' : 'index, follow';
        const ogTitle = p.ogTitle || pageTitle;
        const ogDesc = p.ogDescription || metaDesc;
        const ogImage = p.ogImage ? getSanityImageUrl(p.ogImage) : imageUrl;

        // Dynamic category taxonomy resolution
        let categoryName = 'Disposable Vapes';
        let categoryHash = 'disposable';

        if (p.category && p.category.name) {
            categoryName = p.category.name;
            categoryHash = (p.category.slug && p.category.slug.current) ? p.category.slug.current : slugify(p.category.name);
        } else if (p.productType === 'starterKit') {
            categoryName = 'Starter Kits';
            categoryHash = 'starterKit';
        } else if (p.productType === 'replacementPod') {
            categoryName = 'Replacement Pods';
            categoryHash = 'replacementPod';
        } else if (p.productType === 'disposable') {
            categoryName = 'Disposable Vapes';
            categoryHash = 'disposable';
        }

        let typeLabel = categoryName;
        let specLabel = p.puffs ? `${p.puffs} Puffs` : `${typeLabel}`;
        let stockLabel = isOutOfStock ? 'Out of Stock' : 'In Stock & Ready for Dispatch';

        // Descriptive Alt Text
        const altText = `${prodName}${brand && !prodName.toLowerCase().includes(brand.toLowerCase()) ? ' by ' + brand : ''} — JVAPES Kenya`;

        // Flavor section HTML
        let flavorHtml = '';
        if (p.flavors && Array.isArray(p.flavors) && p.flavors.length > 0) {
            flavorHtml = `
                <div style="margin-bottom: 24px;" class="flavor-selection-block">
                    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">Choose Flavor(s) / Option (Select 1 or more):</label>
                    <div class="flavor-pills-container" style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${p.flavors.map((f, idx) => `<button type="button" class="flavor-pill-btn${idx === 0 ? ' active' : ''}" data-flavor="${f}">${f}</button>`).join('')}
                    </div>
                </div>
            `;
        }

        const whatsappText = encodeURIComponent(`Hi JVAPES, I want to order ${prodName} (${formattedPrice} KES) from https://jvapes.store/product/${slug}.html`);

        // Structured Data: Product (Full Schema.org completeness)
        const structuredData = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": prodName,
            "image": [imageUrl],
            "description": metaDesc,
            "brand": {
                "@type": "Brand",
                "name": brand
            },
            ...(p.sku ? { "sku": String(p.sku) } : {}),
            "offers": {
                "@type": "Offer",
                "url": canonicalUrl,
                "priceCurrency": "KES",
                "price": price,
                "priceValidUntil": "2026-12-31",
                "itemCondition": "https://schema.org/NewCondition",
                "availability": isOutOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
                "seller": {
                    "@type": "Store",
                    "name": "JVAPES",
                    "url": BASE_URL,
                    "telephone": "+254741658556"
                }
            }
        };

        // Structured Data: BreadcrumbList (Hierarchy: Home > Category > Product)
        const breadcrumbData = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": BASE_URL
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": categoryName,
                    "item": `${BASE_URL}/category/${categoryHash}.html`
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": prodName,
                    "item": canonicalUrl
                }
            ]
        };

        let html = template
            .replace(/{{PAGE_TITLE}}/g, pageTitle)
            .replace(/{{META_DESCRIPTION}}/g, metaDesc)
            .replace(/{{ROBOTS_DIRECTIVE}}/g, robots)
            .replace(/{{CANONICAL_URL}}/g, canonicalUrl)
            .replace(/{{OG_TITLE}}/g, ogTitle)
            .replace(/{{OG_DESCRIPTION}}/g, ogDesc)
            .replace(/{{OG_IMAGE}}/g, ogImage)
            .replace(/{{STRUCTURED_DATA}}/g, JSON.stringify(structuredData, null, 2))
            .replace(/{{BREADCRUMB_DATA}}/g, JSON.stringify(breadcrumbData, null, 2))
            .replace(/{{PRODUCT_NAME}}/g, prodName)
            .replace(/{{PRODUCT_BRAND}}/g, brand)
            .replace(/{{PRODUCT_CATEGORY_TITLE}}/g, categoryName)
            .replace(/{{PRODUCT_CATEGORY_HASH}}/g, categoryHash)
            .replace(/{{PRODUCT_ALT_TEXT}}/g, altText)
            .replace(/{{PRODUCT_TYPE_LABEL}}/g, typeLabel)
            .replace(/{{PRODUCT_SPEC_LABEL}}/g, specLabel)
            .replace(/{{STOCK_STATUS_LABEL}}/g, stockLabel)
            .replace(/{{FORMATTED_PRICE}}/g, formattedPrice)
            .replace(/{{PRODUCT_IMAGE_URL}}/g, imageUrl)
            .replace(/{{PRODUCT_ID}}/g, p._id || '')
            .replace(/{{WHATSAPP_ORDER_TEXT}}/g, whatsappText)
            .replace(/{{FLAVOR_SECTION_HTML}}/g, flavorHtml)
            .replace(/{{PRODUCT_DESCRIPTION_HTML}}/g, renderDescription(p.description));

        const targetFile = path.join(outputDir, `${slug}.html`);
        fs.writeFileSync(targetFile, html, 'utf8');
        generatedUrls.push(`${BASE_URL}/product/${slug}.html`);
    });

    console.log(`🎉 Generated ${generatedUrls.length} static product pages under /product/`);

    // ==========================================
    // GENERATE CATEGORY & BRAND STATIC HUBS
    // ==========================================
    const categoryTemplatePath = path.join(__dirname, '../templates/category-template.html');
    const categoryUrls = [];
    const brandUrls = [];

    if (fs.existsSync(categoryTemplatePath)) {
        const catTemplate = fs.readFileSync(categoryTemplatePath, 'utf8');

        // Helper to render product card grid item
        function renderCardHtml(p) {
            const prodName = p.name || 'Vape Device';
            const brand = p.brand || 'JVAPES';
            const price = Number(p.price || 0);
            const formattedPrice = price.toLocaleString('en-KE');
            const imageUrl = getSanityImageUrl(p.image);
            const altText = `${prodName}${brand && !prodName.toLowerCase().includes(brand.toLowerCase()) ? ' by ' + brand : ''} — JVAPES Kenya`;
            const typeLabel = p.productType === 'starterKit' ? 'Starter Kit' : (p.productType === 'replacementPod' ? 'Replacement Pod' : 'Disposable Vape');
            const specLabel = p.puffs ? `${p.puffs} Puffs` : typeLabel;
            const slug = p.assignedSlug || slugify(prodName);
            const whatsappText = encodeURIComponent(`Hi JVAPES, I want to order ${prodName} (${formattedPrice} KES)`);

            return `
                <div class="glass-card product-item" style="display: flex; flex-direction: column; justify-content: space-between; border-radius: 16px; padding: 20px;">
                    <div class="product-image-wrap" style="position: relative; overflow: hidden; border-radius: 12px; margin-bottom: 14px; background: rgba(0,0,0,0.25); text-align: center; padding: 20px;">
                        <img src="${imageUrl}" alt="${altText}" loading="lazy" style="max-height: 180px; width: 100%; object-fit: contain;">
                    </div>
                    <div class="product-details" style="display: flex; flex-direction: column; flex: 1; justify-content: space-between;">
                        <div>
                            <span class="brand-lbl" style="font-size: 11px; text-transform: uppercase; color: #d4af37; letter-spacing: 1px; font-weight: 600;">${brand}</span>
                            <h3 class="product-name" style="font-size: 16px; margin: 6px 0 8px 0; color: #fff;">
                                <a href="../product/${slug}.html" style="color: inherit; text-decoration: none;">${prodName}</a>
                            </h3>
                            <div style="font-size: 12.5px; color: #a1a1aa; margin-bottom: 14px;">${specLabel}</div>
                        </div>
                        <div>
                            <div style="font-size: 18px; font-weight: 700; color: #d4af37; margin-bottom: 12px;">KES ${formattedPrice}</div>
                            <div style="display: flex; gap: 8px;">
                                <a href="../product/${slug}.html" class="btn btn-secondary" style="flex: 1; text-align: center; text-decoration: none; padding: 8px 10px; font-size: 12.5px;">View Details</a>
                                <a href="https://wa.me/254741658556?text=${whatsappText}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp" style="text-decoration: none; padding: 8px 12px; font-size: 12.5px; display: inline-flex; align-items: center; justify-content: center;">WhatsApp</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 1. Category Hubs
        const categoryDir = path.join(__dirname, '../category');
        if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir, { recursive: true });

        const categoryDefs = [
            {
                type: 'disposable',
                slug: 'disposable-vapes',
                name: 'Disposable Vapes',
                badge: 'Convenience Redefined',
                title: 'Buy Disposable Vapes in Kenya — Ruiru & Nairobi Same-Day Delivery | JVAPES',
                desc: 'Explore Kenya’s premium collection of genuine high-puff disposable vapes. Pre-filled with smooth nicotine salt e-liquids, draw-activated mechanics, smart battery screens, and same-day express delivery across Ruiru, Nairobi, and countrywide.'
            },
            {
                type: 'starterKit',
                slug: 'starter-kits',
                name: 'Vape Starter Kits',
                badge: 'Hardware & Pod Systems',
                title: 'Buy Vape Starter Kits in Kenya — Ruiru & Nairobi Delivery | JVAPES',
                desc: 'Discover high-performance rechargeable vape starter kits and modular pod hardware in Kenya. Engineered for clean taste, lasting battery lifespans, and economic long-term vapor performance.'
            },
            {
                type: 'replacementPod',
                slug: 'replacement-pods',
                name: 'Replacement Pods & Coils',
                badge: 'Refills & Accessories',
                title: 'Buy Vape Replacement Pods in Kenya — Ruiru & Nairobi | JVAPES',
                desc: 'Shop authentic replacement pods, closed-loop cartridges, and precision mesh coils for leading vapor platforms in Kenya with instant same-day express dispatch.'
            }
        ];

        categoryDefs.forEach(cat => {
            const catProducts = products.filter(p => (p.productType || 'disposable') === cat.type);
            const gridHtml = catProducts.map(p => renderCardHtml(p)).join('');
            const canonicalUrl = `${BASE_URL}/category/${cat.slug}.html`;

            const structuredData = {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "name": cat.name,
                "description": cat.desc,
                "url": canonicalUrl,
                "mainEntity": {
                    "@type": "ItemList",
                    "itemListElement": catProducts.map((p, idx) => ({
                        "@type": "ListItem",
                        "position": idx + 1,
                        "url": `${BASE_URL}/product/${p.assignedSlug || slugify(p.name || 'item')}.html`,
                        "name": p.name || 'Vape Device'
                    }))
                }
            };

            const breadcrumbData = {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE_URL },
                    { "@type": "ListItem", "position": 2, "name": "Categories", "item": `${BASE_URL}/#categories` },
                    { "@type": "ListItem", "position": 3, "name": cat.name, "item": canonicalUrl }
                ]
            };

            let html = catTemplate
                .replace(/{{PAGE_TITLE}}/g, cat.title)
                .replace(/{{META_DESCRIPTION}}/g, cat.desc)
                .replace(/{{ROBOTS_DIRECTIVE}}/g, 'index, follow')
                .replace(/{{CANONICAL_URL}}/g, canonicalUrl)
                .replace(/{{OG_TITLE}}/g, cat.title)
                .replace(/{{OG_DESCRIPTION}}/g, cat.desc)
                .replace(/{{OG_IMAGE}}/g, `${BASE_URL}/favicon.png`)
                .replace(/{{STRUCTURED_DATA}}/g, JSON.stringify(structuredData, null, 2))
                .replace(/{{BREADCRUMB_DATA}}/g, JSON.stringify(breadcrumbData, null, 2))
                .replace(/{{HUB_TYPE_LABEL}}/g, 'Categories')
                .replace(/{{COLLECTION_NAME}}/g, cat.name)
                .replace(/{{COLLECTION_BADGE}}/g, cat.badge)
                .replace(/{{COLLECTION_DESCRIPTION}}/g, cat.desc)
                .replace(/{{PRODUCT_COUNT}}/g, String(catProducts.length))
                .replace(/{{PRODUCTS_GRID_HTML}}/g, gridHtml);

            fs.writeFileSync(path.join(categoryDir, `${cat.slug}.html`), html, 'utf8');
            categoryUrls.push(canonicalUrl);
        });

        console.log(`🎉 Generated ${categoryUrls.length} static category hubs under /category/`);

        // 2. Brand Hubs
        const brandDir = path.join(__dirname, '../brand');
        if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true });

        // Group unique brands
        const brandMap = new Map();
        products.forEach(p => {
            let brandRaw = (p.brand || 'JVAPES').trim();
            let brandClean = brandRaw;
            if (brandRaw.toLowerCase().startsWith('lost mary')) brandClean = 'Lost Mary';
            if (brandRaw.toLowerCase().startsWith('vapengin')) brandClean = 'Vapengin';
            if (brandRaw.toLowerCase().startsWith('oxbar')) brandClean = 'Oxbar';
            if (brandRaw.toLowerCase().startsWith('elfbar')) brandClean = 'Elfbar';
            if (brandRaw.toLowerCase().startsWith('happy bar')) brandClean = 'Happy Bar';
            if (brandRaw.toLowerCase().startsWith('dummy')) brandClean = 'Dummy Vapes';

            const brandSlug = slugify(brandClean);
            if (!brandMap.has(brandSlug)) {
                brandMap.set(brandSlug, { name: brandClean, slug: brandSlug, products: [] });
            }
            brandMap.get(brandSlug).products.push(p);
        });

        brandMap.forEach((b) => {
            const canonicalUrl = `${BASE_URL}/brand/${b.slug}.html`;
            const title = `Buy ${b.name} Vapes in Kenya — Ruiru & Nairobi Delivery | JVAPES`;
            const desc = `Shop 100% genuine ${b.name} vape devices, disposables, and pod systems in Kenya. Same-day express boda delivery across Ruiru, Nairobi, and countrywide dispatch. Pay on delivery via M-Pesa. 18+ only.`;

            const gridHtml = b.products.map(p => renderCardHtml(p)).join('');

            const structuredData = {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "name": `${b.name} Vape Devices`,
                "description": desc,
                "url": canonicalUrl,
                "mainEntity": {
                    "@type": "ItemList",
                    "itemListElement": b.products.map((p, idx) => ({
                        "@type": "ListItem",
                        "position": idx + 1,
                        "url": `${BASE_URL}/product/${p.assignedSlug || slugify(p.name || 'item')}.html`,
                        "name": p.name || 'Vape Device'
                    }))
                }
            };

            const breadcrumbData = {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE_URL },
                    { "@type": "ListItem", "position": 2, "name": "Brands", "item": `${BASE_URL}/#brands` },
                    { "@type": "ListItem", "position": 3, "name": b.name, "item": canonicalUrl }
                ]
            };

            let html = catTemplate
                .replace(/{{PAGE_TITLE}}/g, title)
                .replace(/{{META_DESCRIPTION}}/g, desc)
                .replace(/{{ROBOTS_DIRECTIVE}}/g, 'index, follow')
                .replace(/{{CANONICAL_URL}}/g, canonicalUrl)
                .replace(/{{OG_TITLE}}/g, title)
                .replace(/{{OG_DESCRIPTION}}/g, desc)
                .replace(/{{OG_IMAGE}}/g, `${BASE_URL}/favicon.png`)
                .replace(/{{STRUCTURED_DATA}}/g, JSON.stringify(structuredData, null, 2))
                .replace(/{{BREADCRUMB_DATA}}/g, JSON.stringify(breadcrumbData, null, 2))
                .replace(/{{HUB_TYPE_LABEL}}/g, 'Brands')
                .replace(/{{COLLECTION_NAME}}/g, `${b.name} Vaporizers`)
                .replace(/{{COLLECTION_BADGE}}/g, 'Official Brand Collection')
                .replace(/{{COLLECTION_DESCRIPTION}}/g, desc)
                .replace(/{{PRODUCT_COUNT}}/g, String(b.products.length))
                .replace(/{{PRODUCTS_GRID_HTML}}/g, gridHtml);

            fs.writeFileSync(path.join(brandDir, `${b.slug}.html`), html, 'utf8');
            brandUrls.push(canonicalUrl);
        });

        console.log(`🎉 Generated ${brandUrls.length} static brand hubs under /brand/`);
    }

    // Generate Updated Sitemap
    const todayIso = new Date().toISOString().split('T')[0];
    const staticPages = [
        { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily' },
        { loc: `${BASE_URL}/about.html`, priority: '0.8', changefreq: 'monthly' },
        { loc: `${BASE_URL}/guides.html`, priority: '0.8', changefreq: 'weekly' },
        { loc: `${BASE_URL}/faq.html`, priority: '0.7', changefreq: 'monthly' },
        { loc: `${BASE_URL}/contact.html`, priority: '0.7', changefreq: 'monthly' },
        { loc: `${BASE_URL}/legal.html`, priority: '0.4', changefreq: 'monthly' },
        { loc: `${BASE_URL}/terms.html`, priority: '0.4', changefreq: 'monthly' }
    ];

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(page => `    <url>
        <loc>${page.loc}</loc>
        <lastmod>${todayIso}</lastmod>
        <changefreq>${page.changefreq}</changefreq>
        <priority>${page.priority}</priority>
    </url>`).join('\n')}
${categoryUrls.map(url => `    <url>
        <loc>${url}</loc>
        <lastmod>${todayIso}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.85</priority>
    </url>`).join('\n')}
${brandUrls.map(url => `    <url>
        <loc>${url}</loc>
        <lastmod>${todayIso}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.85</priority>
    </url>`).join('\n')}
${generatedUrls.map(url => `    <url>
        <loc>${url}</loc>
        <lastmod>${todayIso}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>`).join('\n')}
</urlset>`;

    const sitemapPath = path.join(__dirname, '../sitemap.xml');
    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    console.log(`✅ Updated sitemap.xml with ${staticPages.length + categoryUrls.length + brandUrls.length + generatedUrls.length} total URLs.`);
}

generate().catch(console.error);
