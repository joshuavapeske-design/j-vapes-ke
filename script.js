// Global Staging App Configuration
const SANITY_PROJECT_ID = 'pkrx1c35'; // Ensure this matches your fresh Sandbox ID
const SANITY_DATASET = 'production';
const SANITY_URL = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${SANITY_DATASET}`;

let allProducts = [];
let activePromos = [];
let cart = [];
let wishlist = JSON.parse(localStorage.getItem('jvapes_wishlist') || '[]');

// Site-wide promo codes. Combines whatever Sanity returns (if you add a
// "promoCode" document type with {code, discountPercentage}) with a local
// fallback list, so codes work even before that schema exists.
let promoCodes = {
    'JOSHUA': 10,
    'VAPE15': 15
};
let appliedPromo = null; // { code, discountPercentage }

// Geolocation Coordinates pointing accurately to Ruiru dispatch center
const GOOGLE_MAPS_ROUTING = "https://maps.google.com/?q=-1.1462,36.9610"; 
const WHATSAPP_PHONE = "254741658556"; 

// Dispatch point used to calculate delivery distance (same spot as
// GOOGLE_MAPS_ROUTING above).
const DISPATCH_COORDS = { lat: -1.1462, lon: 36.9610 };

// Boda-style delivery pricing. This is a simple editable formula, not a
// live Uber/Boda rate feed (no public API exists for that) — tune these
// three numbers to match real rates whenever you have them.
const DELIVERY_PRICING = {
    baseFare: 100,   // KES, flat fee that applies to every delivery
    perKm: 40,        // KES per km from the dispatch point
    minFare: 100      // KES, floor so very short trips aren't free
};

// Selected delivery location state. Populated once the customer picks a
// suggestion or uses "my location". Read by renderCartUI() and the
// checkout button handlers below.
let selectedDeliveryLocation = null; // { label, lat, lon, distanceKm, fee }

// Staging Project Application Lifecycle Ignition Loop
document.addEventListener('DOMContentLoaded', () => {
    initAgeGate();
    fetchStorefrontData();
    setupCartListeners();
    setupDeliveryLocationListeners();
    setupFilterToggle();
    setupCategoryTabs();
    setupMobileNav();
    setupPromoListeners();
    setupWishlistListeners();
    setupBrandStrip();

    document.getElementById('retry-load-btn')?.addEventListener('click', fetchStorefrontData);
});

// UX FIX: the filter bar (search/brand/price/flavor) used to sit wide
// open above the fold before any products were visible. It's now
// collapsed behind a toggle button.
function setupFilterToggle() {
    const toggleBtn = document.getElementById('filter-toggle-btn');
    const filterWrapper = document.getElementById('filter-wrapper');
    if (!toggleBtn || !filterWrapper) return;

    toggleBtn.addEventListener('click', () => {
        const isHidden = filterWrapper.classList.toggle('hidden');
        toggleBtn.setAttribute('aria-expanded', String(!isHidden));
    });
}

// UX FIX: category headings used to be individually-clickable <h3> tags
// that hid the other two headings entirely when clicked, with no visual
// cue that they were interactive. Replaced with a proper tab bar; "All"
// shows every section (the default), and picking a category shows just
// that section without the page's other headings vanishing unexpectedly.
function setupCategoryTabs() {
    const tabs = document.querySelectorAll('.category-tab');
    const sections = document.querySelectorAll('.inventory-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetType = tab.getAttribute('data-type');

            tabs.forEach(t => {
                t.classList.toggle('active-filter', t === tab);
                t.setAttribute('aria-selected', String(t === tab));
            });

            sections.forEach(section => {
                if (targetType === 'all' || section.getAttribute('data-category') === targetType) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            });
        });
    });
}

// Left Sidebar Navigation Drawer
function setupMobileNav() {
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('nav-links');
    if (!toggle || !nav) return;

    // Dynamically create dark backdrop overlay if not present in DOM
    let backdrop = document.getElementById('nav-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'nav-backdrop';
        backdrop.className = 'nav-backdrop';
        document.body.appendChild(backdrop);
    }

    const closeBtn = document.getElementById('nav-close-btn');

    function openNav() {
        nav.classList.add('active');
        backdrop.classList.add('active');
        document.body.classList.add('menu-open');
        toggle.setAttribute('aria-expanded', 'true');
    }

    function closeNav() {
        nav.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (nav.classList.contains('active')) {
            closeNav();
        } else {
            openNav();
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closeNav);
    }

    backdrop.addEventListener('click', closeNav);

    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeNav);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('active')) {
            closeNav();
        }
    });
}

// ==========================================
// WISHLIST — persisted in localStorage so it survives a page refresh
// ==========================================
function toggleWishlist(productId) {
    const idx = wishlist.indexOf(productId);
    if (idx === -1) {
        wishlist.push(productId);
        showToast('Added to wishlist');
    } else {
        wishlist.splice(idx, 1);
        showToast('Removed from wishlist');
    }
    localStorage.setItem('jvapes_wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
    renderWishlistUI();
}

function updateWishlistCount() {
    const countEl = document.getElementById('wishlist-count');
    if (countEl) countEl.textContent = wishlist.length;
}

function renderWishlistUI() {
    const container = document.getElementById('wishlist-items-container');
    if (!container) return;

    if (wishlist.length === 0) {
        container.innerHTML = '<p class="text-center empty-state-msg">Your wishlist is empty. Tap the heart on any product to save it here.</p>';
        return;
    }

    const items = wishlist.map(id => allProducts.find(p => p._id === id)).filter(Boolean);

    if (items.length === 0) {
        container.innerHTML = '<p class="text-center empty-state-msg">Loading your saved items...</p>';
        return;
    }

    container.innerHTML = items.map(p => `
        <div class="cart-line-item">
            <div class="cart-line-info">
                <div class="cart-line-name">${p.name}</div>
                <div class="cart-line-price">KES ${Number(p.price || 0).toLocaleString('en-KE')}</div>
            </div>
            <div class="cart-line-controls">
                <button class="btn btn-primary wishlist-add-cart-btn" data-id="${p._id}">Add to Bag</button>
                <button class="remove-cart-item-btn wishlist-remove-btn" data-id="${p._id}" aria-label="Remove from wishlist">&times;</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.wishlist-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleWishlist(btn.getAttribute('data-id')));
    });

    // If the product needs a flavor pick, addToCart() already re-checks
    // the matching dropdown out on the storefront and prompts if none is
    // selected yet, so this can safely just delegate to it.
    container.querySelectorAll('.wishlist-add-cart-btn').forEach(btn => {
        btn.addEventListener('click', () => addToCart(btn.getAttribute('data-id')));
    });
}

function setupWishlistListeners() {
    const wishlistBtn = document.getElementById('wishlist-btn');
    const wishlistDrawer = document.getElementById('wishlist-drawer');
    const closeWishlistBtn = document.getElementById('close-wishlist-btn');

    if (wishlistBtn && wishlistDrawer) {
        wishlistBtn.addEventListener('click', () => {
            renderWishlistUI();
            wishlistDrawer.classList.remove('hidden');
        });
    }

    if (closeWishlistBtn && wishlistDrawer) {
        closeWishlistBtn.addEventListener('click', () => wishlistDrawer.classList.add('hidden'));
    }

    if (wishlistDrawer) {
        wishlistDrawer.addEventListener('click', (e) => {
            if (e.target === wishlistDrawer) wishlistDrawer.classList.add('hidden');
        });
    }

    updateWishlistCount();
}

// ==========================================
// PROMO CODES
// NOTE: this validates codes entirely in the browser against the
// `promoCodes` list defined at the top of this file (plus anything
// pulled from a Sanity "promoCode" document type, if you add one).
// That's fine for a WhatsApp/cash-on-delivery flow where a human
// reconciles the order anyway, but it is NOT secure against someone
// reading this file and finding a code — don't rely on it for anything
// where that matters.
// ==========================================
function setupPromoListeners() {
    const applyBtn = document.getElementById('apply-promo-btn');
    const removeBtn = document.getElementById('remove-promo-btn');
    const input = document.getElementById('promo-code-input');

    if (applyBtn) applyBtn.addEventListener('click', applyPromoCode);
    if (removeBtn) removeBtn.addEventListener('click', removePromoCode);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyPromoCode();
            }
        });
    }
}

function applyPromoCode() {
    const input = document.getElementById('promo-code-input');
    if (!input) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
        showToast('Enter a promo code first');
        return;
    }

    if (promoCodes[code] === undefined) {
        showToast("That code isn't valid");
        return;
    }

    appliedPromo = { code, discountPercentage: promoCodes[code] };
    input.value = '';
    showToast(`"${code}" applied — ${appliedPromo.discountPercentage}% off`);
    renderCartUI();
}

function removePromoCode() {
    appliedPromo = null;
    renderCartUI();
}

// ==========================================
// FEATURED BRAND STRIP — tapping a brand jumps straight to a filtered view
// ==========================================
function setupBrandStrip() {
    document.querySelectorAll('.brand-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const brand = chip.getAttribute('data-brand');
            const filterWrapper = document.getElementById('filter-wrapper');
            const toggleBtn = document.getElementById('filter-toggle-btn');
            const brandSelect = document.getElementById('brand-filter');
            const searchInput = document.getElementById('search-input');

            if (filterWrapper && filterWrapper.classList.contains('hidden')) {
                filterWrapper.classList.remove('hidden');
                toggleBtn?.setAttribute('aria-expanded', 'true');
            }

            // Prefer an exact brand-filter match; fall back to a name
            // search for brands not yet tagged as a `brand` field in Sanity.
            const hasExactOption = brandSelect && [...brandSelect.options].some(o => o.value === brand);
            if (hasExactOption) {
                brandSelect.value = brand;
                if (searchInput) searchInput.value = '';
            } else if (searchInput) {
                searchInput.value = brand;
                if (brandSelect) brandSelect.value = '';
            }

            filterProducts();
            document.querySelector('.category-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// Age Verification Overlay State Switcher
function initAgeGate() {
    const ageGate = document.getElementById('age-gate');
    const verifyBtn = document.getElementById('verify-btn');
    const exitBtn = document.getElementById('exit-btn');
    const exitNote = document.getElementById('age-gate-exit-note');

    if (localStorage.getItem('isOfAge') === 'true') {
        if(ageGate) ageGate.classList.add('hidden');
    }

    if(verifyBtn) {
        verifyBtn.addEventListener('click', () => {
            localStorage.setItem('isOfAge', 'true');
            if(ageGate) ageGate.classList.add('hidden');
        });
    }

    if(exitBtn) {
        exitBtn.addEventListener('click', () => {
            // UX FIX: previously this redirected instantly with zero
            // feedback, which read as the page just breaking. Show a
            // brief, friendly message first, then leave.
            exitBtn.disabled = true;
            if (document.getElementById('verify-btn')) document.getElementById('verify-btn').disabled = true;
            if (exitNote) exitNote.classList.remove('hidden');
            setTimeout(() => {
                window.location.href = "https://www.google.com";
            }, 1800);
        });
    }
}

// Lightweight, non-blocking toast notifications — replaces native
// alert() popups that interrupted browsing on every add-to-cart.
function showToast(message, duration = 2200) {
    const container = document.getElementById('toast-container');
    if (!container) {
        // Fallback if the container isn't present for some reason
        console.log(message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    // Force reflow so the enter transition actually plays
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// OPTIMIZED: Single-Schema GROQ Fetch Request Engine
async function fetchStorefrontData() {
    const skeleton = document.getElementById('loading-skeleton');
    const errorMsg = document.getElementById('load-error-message');

    if (skeleton) skeleton.classList.remove('hidden');
    if (errorMsg) errorMsg.classList.add('hidden');

    // We only need to query all items of type "product" and all items of type "promo"
   const groqQuery = encodeURIComponent(`{
"products": *[_type=="product"]{
 _id,
 name,
 slug,
 brand,
 price,
 stock,
 productType,
 flavors,
 image,
 description,
 puffs,
 seoTitle,
 metaDescription,
 canonicalUrl
},
"promos": *[_type=="promo"]{
 discountPercentage,
 productRef
},
"promoCodes": *[_type=="promoCode"]{
 code,
 discountPercentage
}
}`);

    try {
        const response = await fetch(`${SANITY_URL}?query=${groqQuery}`);
        const { result } = await response.json();

        activePromos = result.promos || [];
        allProducts = result.products || [];

        // Merge any site-configured promo codes from Sanity on top of the
        // local fallback list, keyed by uppercase code.
        (result.promoCodes || []).forEach(pc => {
            if (pc.code) promoCodes[pc.code.toUpperCase()] = pc.discountPercentage;
        });

        populateFilters(allProducts);
        renderStorefront(allProducts);
        injectProductStructuredData(allProducts);
        checkDeepLinkProduct(allProducts);
    } catch (error) {
        console.error("Critical error querying unified product schema vectors:", error);
        // UX FIX: previously a failed fetch left a silently blank page.
        if (errorMsg) errorMsg.classList.remove('hidden');
    } finally {
        if (skeleton) skeleton.classList.add('hidden');
    }
}

// Helper to get clean slug for a product
function getProductSlug(product) {
    if (product.slug && product.slug.current) return product.slug.current;
    if (product.name) {
        return product.name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }
    return product._id;
}

// Injects schema.org Product/Offer JSON-LD for the currently loaded
// catalog so Google can potentially show price/availability rich
// results for product-style searches. Capped at 30 items to keep the
// payload light; re-run whenever the catalog reloads.
function injectProductStructuredData(products) {
    if (!products || products.length === 0) return;

    const existing = document.getElementById('product-structured-data');
    if (existing) existing.remove();

    const itemListElement = products.slice(0, 30).map((product, index) => {
        const slug = getProductSlug(product);
        return {
            "@type": "ListItem",
            "position": index + 1,
            "item": {
                "@type": "Product",
                "name": product.name,
                "brand": product.brand || "JVAPES",
                "offers": {
                    "@type": "Offer",
                    "priceCurrency": "KES",
                    "price": Number(product.price || 0),
                    "availability": (product.stock && product.stock > 0)
                        ? "https://schema.org/InStock"
                        : "https://schema.org/OutOfStock",
                    "url": `https://jvapes.store/product/${slug}.html`
                }
            }
        };
    });

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'product-structured-data';
    script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": itemListElement
    });
    document.head.appendChild(script);
}

// Automatically opens product modal if URL has ?product=slug or #product-slug
function checkDeepLinkProduct(products) {
    const params = new URLSearchParams(window.location.search);
    const productQuery = params.get('product');
    const hash = window.location.hash.replace('#product-', '').replace('#', '');
    const targetSlug = productQuery || hash;

    if (targetSlug) {
        const targetProduct = products.find(p => getProductSlug(p) === targetSlug || p._id === targetSlug);
        if (targetProduct) {
            openProductDetailPanel(targetProduct);
        }
    }
}

// UI Dropdown Dynamic Populator Framework
function populateFilters(products) {
    const filterSelect = document.getElementById('flavor-filter');
    const brandSelect = document.getElementById('brand-filter');

    if (filterSelect) {
        // Clear previous option memory slots safely
        filterSelect.innerHTML = '<option value="">All Flavors</option>';
        const allFlavors = new Set();

        products.forEach(p => {
            if (p.flavors && Array.isArray(p.flavors)) {
                p.flavors.forEach(f => allFlavors.add(f));
            }
        });

        allFlavors.forEach(flavor => {
            const opt = document.createElement('option');
            opt.value = flavor;
            opt.textContent = flavor;
            filterSelect.appendChild(opt);
        });

        filterSelect.addEventListener('change', (e) => handleFilter(e.target.value));
    }

    // BUGFIX: brand dropdown previously had only two hardcoded options
    // (Elfbar, Bugatti) baked into the HTML, so most real brands in your
    // catalog couldn't be filtered by at all. Now built from real data.
    if (brandSelect) {
        const currentValue = brandSelect.value;
        brandSelect.innerHTML = '<option value="">All Brands</option>';
        const allBrands = new Set();

        products.forEach(p => {
            if (p.brand) allBrands.add(p.brand);
        });

        [...allBrands].sort().forEach(brand => {
            const opt = document.createElement('option');
            opt.value = brand;
            opt.textContent = brand;
            brandSelect.appendChild(opt);
        });

        if (currentValue && [...allBrands].includes(currentValue)) {
            brandSelect.value = currentValue;
        }
    }
}

function handleFilter(selectedFlavor) {
    if (!selectedFlavor) {
        renderStorefront(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.flavors && p.flavors.includes(selectedFlavor));
        renderStorefront(filtered);
    }
}

// SMART DOM ROUTING: Splits products dynamically based on the "productType" variable field value
function renderStorefront(products) {
    const dispContainer = document.getElementById('disposables-container');
    const kitContainer = document.getElementById('starter-kits-container');
    const podContainer = document.getElementById('replacement-pods-container');

    if(dispContainer) dispContainer.innerHTML = '';
    if(kitContainer) kitContainer.innerHTML = '';
    if(podContainer) podContainer.innerHTML = '';

    if (products.length === 0) {
        const msg = document.getElementById('no-products-message');
        if(msg) msg.classList.remove('hidden');
        return;
    } else {
        const msg = document.getElementById('no-products-message');
        if(msg) msg.classList.add('hidden');
    }

    products.forEach(product => {
        const cardHtml = generateProductCard(product);
        const type = product.productType || 'disposable';
        
        // Frontend segments products safely by matching your backend list keys
        if (type === 'starterKit' && kitContainer) {
            kitContainer.insertAdjacentHTML('beforeend', cardHtml);
        } else if (type === 'replacementPod' && podContainer) {
            podContainer.insertAdjacentHTML('beforeend', cardHtml);
        } else if (dispContainer) {
            dispContainer.insertAdjacentHTML('beforeend', cardHtml);
        }
    });

    // BUGFIX: this was previously defined as a nested function here and
    // never called, so Add-to-Bag buttons had no click listener at all.
    // Now we call the real (top-level) wiring function after every render.
    wireCardClickListeners();
}

// Card Logic Element & Dynamic Promo Percent Calculation Engine
function generateProductCard(product) {
    const promo = activePromos.find(p => p.productRef && p.productRef._ref === product._id);
    const formatPrice = (n) => Number(n || 0).toLocaleString('en-KE');
    let priceSnippet = `<span class="current-price">KES ${formatPrice(product.price)}</span>`;
    let promoBadge = '';

    if (!product.price || Number(product.price) <= 0) {
        priceSnippet = `<span class="current-price price-inquire">Contact for Price</span>`;
    } else if (promo) {
        const discountAmount = product.price * (promo.discountPercentage / 100);
        const salePrice = product.price - discountAmount;
        priceSnippet = `
            <span class="original-price">KES ${formatPrice(product.price)}</span>
            <span class="current-price">KES ${formatPrice(salePrice)}</span>
        `;
        promoBadge = `<div class="promo-tag">-${promo.discountPercentage}%</div>`;
    }

    let puffsSnippet = '';
    if (product.puffs) {
        puffsSnippet = `<span class="product-puffs-badge">${Number(product.puffs).toLocaleString('en-KE')} Puffs</span>`;
    }

    const slug = getProductSlug(product);

    let stockActionHtml = `
        <a href="product/${slug}.html" class="btn btn-secondary view-details-card-btn" style="width:100%; text-decoration:none; text-align:center; display:block; padding: 10px 14px;">
            Details
        </a>
    `;
    if (product.stock === 0 || product.stock === undefined) {
        stockActionHtml = `<button class="btn btn-secondary disabled-stock" style="width:100%; cursor:not-allowed;" disabled>Out of Stock</button>`;
    }

    let imageUrl = 'images/product-placeholder.jpg';
    if (product.image && product.image.asset && product.image.asset._ref) {
        const assetRef = product.image.asset._ref;
        const cleanId = assetRef.replace(/^image-/, '');
        const lastHyphenIndex = cleanId.lastIndexOf('-');
        if (lastHyphenIndex !== -1) {
            const base = cleanId.substring(0, lastHyphenIndex);
            const ext = cleanId.substring(lastHyphenIndex + 1);
            imageUrl = `https://cdn.sanity.io/images/${SANITY_PROJECT_ID}/${SANITY_DATASET}/${base}.${ext}`;
        }
    }

    return `
        <div class="product-item" data-id="${product._id}" data-slug="${slug}" data-name="${(product.name || '').toLowerCase()}" data-brand="${product.brand || ''}" data-price="${product.price || 0}" data-flavor="${(product.flavors || []).join(',').toLowerCase()}">
            ${promoBadge}
            <div class="product-image-wrap">
                <a href="product/${slug}.html" class="product-image-link" style="display:block; width:100%; height:100%; text-decoration:none; color:inherit;">
                    <img src="${imageUrl}" alt="${product.name || 'Vape Device'} — JVAPES Kenya" loading="lazy" onerror="this.onerror=null; this.src='images/product-placeholder.jpg';">
                </a>
                <button type="button" class="wishlist-heart-btn${wishlist.includes(product._id) ? ' active' : ''}" data-id="${product._id}" aria-label="Toggle wishlist">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 21s-7.5-4.7-10.1-9.3C.4 8.6 1.8 4.9 5.4 4.1c2.2-.5 4.3.5 5.6 2.3 1.3-1.8 3.4-2.8 5.6-2.3 3.6.8 5 4.5 3.5 7.6C19.5 16.3 12 21 12 21z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <div class="product-details">
                <div class="product-header-meta">
                    <span class="brand-lbl">${product.brand || 'JVAPES'}</span>
                    ${puffsSnippet}
                </div>
                <h4 class="product-name">
                    <a href="product/${slug}.html" class="product-link" style="text-decoration:none; color:inherit;">${product.name}</a>
                </h4>
                <div class="price-row">
                    ${priceSnippet}
                </div>
                ${stockActionHtml}
            </div>
        </div>
    `;
}

// Click Listeners interceptor to navigate to dedicated product page
function wireCardClickListeners() {
    document.querySelectorAll('.product-item').forEach(card => {
        const slug = card.getAttribute('data-slug');

        // Clicking the product card or image navigates directly to dedicated product page
        card.addEventListener('click', (e) => {
            // Prevent navigation if user clicked wishlist button or add to bag button
            if (e.target.closest('.wishlist-heart-btn') || e.target.closest('.add-cart-btn')) {
                return;
            }
            if (slug) {
                window.location.href = `product/${slug}.html`;
            }
        });

        // Wishlist heart toggle
        const heartBtn = card.querySelector('.wishlist-heart-btn');
        if (heartBtn) {
            heartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleWishlist(heartBtn.getAttribute('data-id'));
                heartBtn.classList.toggle('active');
            });
        }
    });

    document.querySelectorAll('.add-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart(btn.getAttribute('data-id'));
        });
    });
}

// Navigates directly to the dedicated product page
function openProductDetailPanel(product) {
    if (!product) return;
    const slug = getProductSlug(product);
    window.location.href = `product/${slug}.html`;
}

// --- Delivery distance + pricing helpers -----------------------------

// Haversine straight-line distance in km between two lat/lon points.
// This is a fair approximation for a boda-style per-km fee — it's not
// road distance, but it's what's realistically computable without a
// paid routing API.
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateDeliveryFee(distanceKm) {
    const raw = DELIVERY_PRICING.baseFare + distanceKm * DELIVERY_PRICING.perKm;
    return Math.max(Math.round(raw), DELIVERY_PRICING.minFare);
}

// Debounce helper so we don't hit Nominatim on every keystroke.
function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Sets the confirmed delivery location, computes distance + fee, and
// refreshes the cart totals / confirmation UI.
function setDeliveryLocation(label, lat, lon) {
    const distanceKm = haversineDistanceKm(DISPATCH_COORDS.lat, DISPATCH_COORDS.lon, lat, lon);
    const fee = calculateDeliveryFee(distanceKm);

    selectedDeliveryLocation = { label, lat, lon, distanceKm, fee };

    const input = document.getElementById('delivery-location-input');
    const searchWrap = document.querySelector('.delivery-location-search');
    const confirmedRow = document.getElementById('delivery-location-confirmed');
    const confirmedText = document.getElementById('delivery-location-confirmed-text');

    if (input) input.value = '';
    if (searchWrap) searchWrap.classList.add('hidden');
    if (confirmedRow) confirmedRow.classList.remove('hidden');
    if (confirmedText) confirmedText.textContent = label;

    hideLocationSuggestions();
    renderCartUI();
}

function clearDeliveryLocation() {
    selectedDeliveryLocation = null;
    const searchWrap = document.querySelector('.delivery-location-search');
    const confirmedRow = document.getElementById('delivery-location-confirmed');
    if (searchWrap) searchWrap.classList.remove('hidden');
    if (confirmedRow) confirmedRow.classList.add('hidden');
    renderCartUI();
}

function hideLocationSuggestions() {
    const list = document.getElementById('location-suggestions-list');
    if (list) {
        list.classList.add('hidden');
        list.innerHTML = '';
    }
}

function renderLocationSuggestions(items) {
    const list = document.getElementById('location-suggestions-list');
    if (!list) return;

    if (!items || items.length === 0) {
        list.innerHTML = '<li class="suggestions-status">No matches found — try a different search</li>';
        list.classList.remove('hidden');
        return;
    }

    list.innerHTML = items.map((place, i) =>
        `<li data-index="${i}">${place.display_name}</li>`
    ).join('');
    list.classList.remove('hidden');

    list.querySelectorAll('li[data-index]').forEach(li => {
        li.addEventListener('click', () => {
            const place = items[parseInt(li.getAttribute('data-index'), 10)];
            setDeliveryLocation(place.display_name, parseFloat(place.lat), parseFloat(place.lon));
        });
    });
}

// Free address search via OpenStreetMap's Nominatim API. Biased toward
// Nairobi/Kiambu (Ruiru) so short local queries match nearby places
// first. Rate limits are generous for light client-side use.
async function searchLocations(query) {
    const list = document.getElementById('location-suggestions-list');
    if (list) {
        list.innerHTML = '<li class="suggestions-status">Searching...</li>';
        list.classList.remove('hidden');
    }
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=6&countrycodes=ke&viewbox=36.60,-1.00,37.20,-1.35&bounded=0&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        renderLocationSuggestions(data);
    } catch (err) {
        console.error('Location search failed:', err);
        if (list) {
            list.innerHTML = '<li class="suggestions-status">Search unavailable — check your connection</li>';
            list.classList.remove('hidden');
        }
    }
}

// Reverse geocode a lat/lon (from the browser's Geolocation API) back
// into a readable address label for the confirmation row.
async function reverseGeocode(lat, lon) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        return data && data.display_name ? data.display_name : `Pinned location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    } catch (err) {
        console.error('Reverse geocode failed:', err);
        return `Pinned location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    }
}

function setupDeliveryLocationListeners() {
    const input = document.getElementById('delivery-location-input');
    const useLocationBtn = document.getElementById('use-my-location-btn');
    const changeLocationBtn = document.getElementById('change-location-btn');
    const searchWrap = document.querySelector('.delivery-location-search');

    if (input) {
        const debouncedSearch = debounce((val) => {
            if (val.trim().length < 3) {
                hideLocationSuggestions();
                return;
            }
            searchLocations(val.trim());
        }, 450);

        input.addEventListener('input', (e) => debouncedSearch(e.target.value));

        input.addEventListener('focus', () => {
            if (input.value.trim().length >= 3) debouncedSearch(input.value.trim());
        });
    }

    // Close suggestions when clicking elsewhere in the drawer.
    document.addEventListener('click', (e) => {
        if (searchWrap && !searchWrap.contains(e.target)) hideLocationSuggestions();
    });

    if (useLocationBtn) {
        useLocationBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                showToast('Location access is not supported on this device');
                return;
            }
            useLocationBtn.classList.add('is-loading');
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const label = await reverseGeocode(latitude, longitude);
                    useLocationBtn.classList.remove('is-loading');
                    setDeliveryLocation(label, latitude, longitude);
                },
                (err) => {
                    useLocationBtn.classList.remove('is-loading');
                    console.error('Geolocation failed:', err);
                    showToast('Could not access your location — try typing your address instead');
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    if (changeLocationBtn) {
        changeLocationBtn.addEventListener('click', clearDeliveryLocation);
    }
}

function setupCartListeners() {
    const modal = document.getElementById('product-detail-modal');
    const closeDetailBtn = document.getElementById('close-detail-btn');
    
    const closeModal = () => {
        if (modal) modal.classList.add('hidden');
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
        }
    };

    if(closeDetailBtn && modal) {
        closeDetailBtn.addEventListener('click', closeModal);
    }
    
    window.addEventListener('click', (e) => {
        if (modal && e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // BUGFIX: clicking the Bag icon had no listener at all, so nothing
    // ever happened. Wire it up to open the cart drawer.
    const cartBtn = document.getElementById('cart-btn');
    const cartDrawerOverlay = document.getElementById('cart-drawer');
    const closeCartBtn = document.getElementById('close-cart-btn');

    if (cartBtn && cartDrawerOverlay) {
        cartBtn.addEventListener('click', () => {
            renderCartUI();
            cartDrawerOverlay.classList.remove('hidden');
        });
    }

    if (closeCartBtn && cartDrawerOverlay) {
        closeCartBtn.addEventListener('click', () => {
            cartDrawerOverlay.classList.add('hidden');
        });
    }

    // Close the drawer when clicking the dark overlay background
    if (cartDrawerOverlay) {
        cartDrawerOverlay.addEventListener('click', (e) => {
            if (e.target === cartDrawerOverlay) cartDrawerOverlay.classList.add('hidden');
        });
    }

    const whatsappCheckoutBtn = document.getElementById('whatsapp-checkout-btn');
    const codCheckoutBtn = document.getElementById('cod-checkout-btn');

    // Builds the order recap sent to WhatsApp, including the applied
    // promo discount and a thank-you line before the customer leaves.
    function buildOrderMessage(paymentNote) {
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const discountAmount = appliedPromo ? subtotal * (appliedPromo.discountPercentage / 100) : 0;
        const deliveryFee = selectedDeliveryLocation ? selectedDeliveryLocation.fee : 0;
        const total = subtotal - discountAmount + deliveryFee;

        const lines = cart.map(item =>
            `${item.quantity}x ${item.name}${item.flavor ? ' (' + item.flavor + ')' : ''} - KES ${(item.price * item.quantity).toLocaleString('en-KE')}`
        );

        let message = `Hi! I'd like to order:\n${lines.join('\n')}\n\nSubtotal: KES ${subtotal.toLocaleString('en-KE')}`;
        if (appliedPromo) {
            message += `\nPromo "${appliedPromo.code}" (-${appliedPromo.discountPercentage}%): -KES ${discountAmount.toLocaleString('en-KE')}`;
        }
        if (selectedDeliveryLocation) {
            message += `\nDelivery (${selectedDeliveryLocation.distanceKm.toFixed(1)} km): KES ${deliveryFee.toLocaleString('en-KE')}`;
        }
        message += `\nTotal: KES ${total.toLocaleString('en-KE')}`;
        if (paymentNote) message += `\nPayment: ${paymentNote}`;
        if (selectedDeliveryLocation) {
            message += `\n\nDelivery to: ${selectedDeliveryLocation.label}`;
            message += `\nMap pin: https://maps.google.com/?q=${selectedDeliveryLocation.lat},${selectedDeliveryLocation.lon}`;
        }
        message += `\n\nThank you for shopping with J_VAPES.KE!`;

        // BUGFIX: previously built with manual %0A substitutions and no
        // escaping, so a literal "%" in "-10%" or any special character
        // in a product name could corrupt the WhatsApp link. Building a
        // plain string and encoding it once with encodeURIComponent is
        // correct regardless of what's in the cart.
        return encodeURIComponent(message);
    }

    if (whatsappCheckoutBtn) {
        whatsappCheckoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showToast('Your bag is empty');
                return;
            }
            if (!selectedDeliveryLocation) {
                showToast('Please confirm your delivery location first');
                document.getElementById('delivery-location-input')?.focus();
                return;
            }
            const encodedMessage = buildOrderMessage(null);
            // UX FIX: say thank you before sending the customer off to
            // WhatsApp, instead of silently opening a new tab.
            showToast('Thank you! Opening WhatsApp to confirm your order...');
            setTimeout(() => {
                window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodedMessage}`, '_blank');
            }, 900);
        });
    }

    // BUGFIX: this button previously had no click listener attached at
    // all — clicking "Pay via M-Pesa or Cash on Delivery" did nothing.
    // There's no payment gateway wired up, so this routes the same order
    // recap to WhatsApp with a note on the preferred payment method,
    // which matches how the rest of the site (and terms.html) describes
    // fulfillment actually working.
    if (codCheckoutBtn) {
        codCheckoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showToast('Your bag is empty');
                return;
            }
            if (!selectedDeliveryLocation) {
                showToast('Please confirm your delivery location first');
                document.getElementById('delivery-location-input')?.focus();
                return;
            }
            const encodedMessage = buildOrderMessage('M-Pesa / Cash on Delivery');
            showToast('Thank you! Opening WhatsApp to confirm your order...');
            setTimeout(() => {
                window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodedMessage}`, '_blank');
            }, 900);
        });
    }
}

// Renders the cart drawer's item list and running total, and keeps the
// header bag-count badge in sync. Call this any time `cart` changes.
function renderCartUI() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-estimate');
    const countEl = document.getElementById('cart-count');

    if (countEl) {
        const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
        countEl.textContent = totalQty;
    }

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center">Your bag is empty.</p>';
    } else {
        // UX FIX: previously the only way to change quantity was to
        // delete the whole line and re-add it from the product card.
        container.innerHTML = cart.map((item, index) => `
            <div class="cart-line-item">
                <div class="cart-line-info">
                    <div class="cart-line-name">${item.name}</div>
                    ${item.flavor ? `<div class="cart-line-flavor">${item.flavor}</div>` : ''}
                    <div class="cart-line-price">KES ${Number(item.price).toLocaleString('en-KE')} each</div>
                </div>
                <div class="cart-line-controls">
                    <div class="qty-stepper">
                        <button class="qty-btn qty-decrease" data-index="${index}" aria-label="Decrease quantity">&minus;</button>
                        <span class="qty-value">${item.quantity}</span>
                        <button class="qty-btn qty-increase" data-index="${index}" aria-label="Increase quantity">&plus;</button>
                    </div>
                    <button class="remove-cart-item-btn" data-index="${index}" aria-label="Remove item">&times;</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.remove-cart-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                cart.splice(idx, 1);
                renderCartUI();
            });
        });

        container.querySelectorAll('.qty-increase').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                cart[idx].quantity += 1;
                renderCartUI();
            });
        });

        container.querySelectorAll('.qty-decrease').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                cart[idx].quantity -= 1;
                if (cart[idx].quantity <= 0) {
                    cart.splice(idx, 1);
                }
                renderCartUI();
            });
        });
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const promoRow = document.getElementById('promo-code-input')?.closest('.promo-row');
    const promoAppliedRow = document.getElementById('promo-applied-row');
    const promoAppliedLabel = document.getElementById('promo-applied-label');
    const subtotalEl = document.getElementById('cart-subtotal');

    if (subtotalEl) subtotalEl.textContent = `KES ${subtotal.toLocaleString('en-KE')}`;

    // Delivery fee row: only shown once a location has been confirmed.
    const deliveryFeeRow = document.getElementById('delivery-fee-row');
    const deliveryDistanceLabel = document.getElementById('delivery-distance-label');
    const deliveryFeeEl = document.getElementById('cart-delivery-fee');
    const deliveryFee = selectedDeliveryLocation ? selectedDeliveryLocation.fee : 0;

    if (selectedDeliveryLocation && cart.length > 0) {
        if (deliveryFeeRow) deliveryFeeRow.classList.remove('hidden');
        if (deliveryDistanceLabel) deliveryDistanceLabel.textContent = `${selectedDeliveryLocation.distanceKm.toFixed(1)} km`;
        if (deliveryFeeEl) deliveryFeeEl.textContent = `KES ${deliveryFee.toLocaleString('en-KE')}`;
    } else if (deliveryFeeRow) {
        deliveryFeeRow.classList.add('hidden');
    }

    let total = subtotal;
    if (appliedPromo && cart.length > 0) {
        const discountAmount = subtotal * (appliedPromo.discountPercentage / 100);
        total = subtotal - discountAmount;
        if (promoRow) promoRow.classList.add('hidden');
        if (promoAppliedRow) promoAppliedRow.classList.remove('hidden');
        if (promoAppliedLabel) promoAppliedLabel.textContent = `"${appliedPromo.code}" applied (−${appliedPromo.discountPercentage}%, −KES ${discountAmount.toLocaleString('en-KE')})`;
    } else {
        if (promoRow) promoRow.classList.remove('hidden');
        if (promoAppliedRow) promoAppliedRow.classList.add('hidden');
    }

    if (cart.length > 0) {
        total += deliveryFee;
    }

    if (totalEl) {
        totalEl.textContent = `KES ${total.toLocaleString('en-KE')}`;
    }
}
// Add this helper to your script.js
function getSanityImageUrl(assetRef) {
    if (!assetRef) return 'placeholder.jpg';
    const parts = assetRef.split('-');
    const id = parts[1];
    const dimensions = parts[2];
    const extension = parts[3];
    return `https://cdn.sanity.io/images/YOUR_PROJECT_ID/production/${id}-${dimensions}.${extension}?w=500&auto=format`;
}
// ==========================================
// UNIVERSAL FILTER ENGINE
// Handles Search, Brand, Price, and Flavor
// ==========================================
function filterProducts() {
    // 1. Get current values from all input elements
    const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
    const selectedBrand = document.getElementById('brand-filter').value;
    const maxPrice = parseFloat(document.getElementById('price-filter').value) || Infinity;
    const selectedFlavor = document.getElementById('flavor-filter').value.toLowerCase();

    // 2. Target all product cards across your grids
    // BUGFIX: cards are actually rendered with class "product-item", not
    // "product-card", so this selector previously matched nothing.
    const productCards = document.querySelectorAll('.product-item');
    let visibleCount = 0;

    productCards.forEach(card => {
        // Extract product meta information from card attributes
        const productName = card.getAttribute('data-name') || '';
        const productBrand = card.getAttribute('data-brand') || ''; 
        const productFlavor = card.getAttribute('data-flavor')?.toLowerCase() || '';
        
        // BUGFIX: price now comes straight from the data-price attribute
        // set in generateProductCard(), rather than a ".product-price"
        // element that doesn't exist in the markup.
        const productPrice = parseFloat(card.getAttribute('data-price')) || 0;

        // 3. Match against all 4 active filter conditions
        const matchesSearch = productName.includes(searchQuery);
        const matchesBrand = selectedBrand === "" || productBrand === selectedBrand;
        const matchesFlavor = selectedFlavor === "" || productFlavor.includes(selectedFlavor);
        const matchesPrice = productPrice <= maxPrice;

        // 4. Show card if it passes all criteria, otherwise hide it
        if (matchesSearch && matchesBrand && matchesFlavor && matchesPrice) {
            card.style.display = 'block'; // Or 'flex' depending on your layout style
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // 5. Toggle the "No Products Found" fallback message if the screen goes blank
    const noProductsMsg = document.getElementById('no-products-message');
    if (noProductsMsg) {
        if (visibleCount === 0) {
            noProductsMsg.classList.remove('hidden');
        } else {
            noProductsMsg.classList.add('hidden');
        }
    }

    // 6. Manage "Clear Filters" visibility button helper
    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
        if (searchQuery || selectedBrand || maxPrice !== Infinity || selectedFlavor) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
}

// Optional Setup: Connect the reset/clear action controls if present
document.getElementById('clear-filters-btn')?.addEventListener('click', resetAllFilters);
document.getElementById('reset-filters-inline')?.addEventListener('click', resetAllFilters);

function resetAllFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('brand-filter').value = '';
    document.getElementById('price-filter').value = '';
    document.getElementById('flavor-filter').value = '';
    filterProducts(); // Re-trigger viewport evaluation pass
}
function addToCart(productId, overrideFlavor){

    const product = allProducts.find(p => p._id === productId);
    if(!product) return;

    let selectedFlavor = overrideFlavor || null;

    if(!selectedFlavor){
        const flavorGroup = document.querySelector(
            `.flavor-dropdown[data-product="${productId}"]`
        );

        if(flavorGroup){
            const selectedOption = flavorGroup.querySelector('.flavor-dropdown-option.selected');
            if(!selectedOption){
                showToast("Please choose a flavor first");
                return;
            }
            selectedFlavor = selectedOption.getAttribute('data-flavor');
        }
    }

    // If the same product+flavor is already in the bag, bump its quantity
    // instead of adding a duplicate line.
    const existing = cart.find(item => item.id === product._id && item.flavor === selectedFlavor);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: product._id,
            name: product.name,
            price: product.price,
            flavor: selectedFlavor,
            quantity: 1
        });
    }

    // BUGFIX: the cart badge/drawer never reflected changes because
    // nothing re-rendered them after an add.
    renderCartUI();

    // UX FIX: alert() blocks the page and needs a dismiss tap on every
    // single add — replaced with a non-blocking toast.
    showToast(`${product.name} added to bag`);
}