/**
 * JVAPES Kenya — Universal Analytics & E-Commerce Event Tracking Layer
 * Standardized Google Analytics 4 (GA4) / Google Tag Manager (GTM) dataLayer pipeline.
 */

(function () {
    'use strict';

    // Initialize dataLayer safely
    window.dataLayer = window.dataLayer || [];

    function pushEvent(eventName, eventParams) {
        try {
            const payload = {
                event: eventName,
                timestamp: new Date().toISOString(),
                ...eventParams
            };
            window.dataLayer.push(payload);
            if (window.gtag && typeof window.gtag === 'function') {
                window.gtag('event', eventName, eventParams);
            }
        } catch (err) {
            console.debug('[JVAPES Analytics] Non-blocking tracking notice:', err.message);
        }
    }

    // Expose global tracker object
    window.JVapesAnalytics = {
        push: pushEvent,

        trackViewItem: function (item) {
            if (!item) return;
            pushEvent('view_item', {
                currency: 'KES',
                value: Number(item.price || 0),
                items: [{
                    item_id: item.id || item._id || '',
                    item_name: item.name || '',
                    item_brand: item.brand || 'JVAPES',
                    item_category: item.productType || 'disposable',
                    price: Number(item.price || 0),
                    quantity: 1
                }]
            });
        },

        trackAddToCart: function (item) {
            if (!item) return;
            pushEvent('add_to_cart', {
                currency: 'KES',
                value: Number(item.price || 0),
                items: [{
                    item_id: item.id || item._id || '',
                    item_name: item.name || '',
                    item_brand: item.brand || 'JVAPES',
                    item_category: item.productType || 'disposable',
                    price: Number(item.price || 0),
                    quantity: 1
                }]
            });
        },

        trackWhatsAppOrder: function (productName, brand, price, source) {
            pushEvent('whatsapp_order_click', {
                currency: 'KES',
                value: Number(price || 0),
                product_name: productName || 'General Inquiry',
                product_brand: brand || 'JVAPES',
                conversion_source: source || 'storefront',
                transport: 'WhatsApp API'
            });
        },

        trackSearchFilter: function (query, brand, flavor, price) {
            pushEvent('search_filter', {
                search_term: query || '',
                filter_brand: brand || 'all',
                filter_flavor: flavor || 'all',
                filter_max_price: price || 'all'
            });
        },

        trackViewItemList: function (listName, items) {
            pushEvent('view_item_list', {
                item_list_name: listName || 'Storefront Catalog',
                items: (items || []).map((p, idx) => ({
                    item_id: p._id || '',
                    item_name: p.name || '',
                    item_brand: p.brand || '',
                    index: idx + 1,
                    price: Number(p.price || 0)
                }))
            });
        }
    };

    // Automatically bind DOM event listeners for WhatsApp and CTA triggers
    document.addEventListener('DOMContentLoaded', function () {
        // Track WhatsApp float button
        const floatWhatsApp = document.querySelector('.whatsapp-float');
        if (floatWhatsApp) {
            floatWhatsApp.addEventListener('click', function () {
                window.JVapesAnalytics.trackWhatsAppOrder('WhatsApp Float Concierge', 'JVAPES', 0, 'floating_widget');
            });
        }

        // Track direct WhatsApp order buttons on product pages
        document.querySelectorAll('.btn-whatsapp').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const productName = document.querySelector('h1')?.textContent?.trim() || 'Product Page Order';
                const brand = document.querySelector('.brand-lbl')?.textContent?.trim() || 'JVAPES';
                const priceText = document.querySelector('.modal-price-row span, .product-price')?.textContent || '0';
                const price = Number(priceText.replace(/[^0-9]/g, '')) || 0;
                window.JVapesAnalytics.trackWhatsAppOrder(productName, brand, price, 'product_detail_cta');
            });
        });

        // Track standalone product Add to Bag
        const directAddBtn = document.getElementById('direct-add-cart-btn');
        if (directAddBtn) {
            directAddBtn.addEventListener('click', function () {
                const id = directAddBtn.getAttribute('data-id');
                const name = document.querySelector('h1')?.textContent?.trim() || '';
                const brand = document.querySelector('.brand-lbl')?.textContent?.trim() || '';
                const priceText = document.querySelector('.modal-price-row span')?.textContent || '0';
                const price = Number(priceText.replace(/[^0-9]/g, '')) || 0;
                window.JVapesAnalytics.trackAddToCart({ id: id, name: name, brand: brand, price: price });
            });
        }
    });
})();
