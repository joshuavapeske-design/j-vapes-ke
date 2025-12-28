import { createClient } from 'https://esm.sh/@sanity/client'

// 1. CONFIGURATION
const client = createClient({
    projectId: '2aveaa71', // Your Project ID
    dataset: 'production',
    useCdn: true,
    apiVersion: '2023-01-01'
})

// 2. STATE MANAGEMENT
window.app = {
    products: [],
    cart: [],
    
    // --- INITIALIZATION ---
    async init() {
        await this.fetchProducts();
        this.loadCart();
    },

    // --- FETCH DATA (Updated for Flavors & Nicotine) ---
    async fetchProducts() {
        const query = `*[_type == "disposable"] {
            _id,
            name,
            brand,
            puffCount,
            nicotine,
            flavors,
            price,
            discount,
            "imageUrl": image.asset->url
        }`;
        
        try {
            this.products = await client.fetch(query);
            this.renderProducts(this.products);
        } catch (err) {
            console.error(err);
            document.getElementById('product-grid').innerHTML = '<p class="text-red-500 text-center col-span-full">Error loading products.</p>';
        }
    },

    // --- RENDER GRID ---
    renderProducts(items) {
        const grid = document.getElementById('product-grid');
        const empty = document.getElementById('empty-state');
        
        if (items.length === 0) {
            grid.classList.add('hidden');
            empty.classList.replace('hidden', 'flex');
            return;
        }

        grid.classList.remove('hidden');
        empty.classList.replace('flex', 'hidden');

        grid.innerHTML = items.map(product => {
            // Calculate Logic
            const onSale = product.discount > 0;
            const finalPrice = onSale ? Math.round(product.price * ((100 - product.discount) / 100)) : product.price;
            
            // Build Flavor Dropdown HTML
            let flavorHtml = '';
            if (product.flavors && product.flavors.length > 0) {
                const options = product.flavors.map(f => `<option value="${f}">${f}</option>`).join('');
                flavorHtml = `
                    <div class="mt-3">
                        <label class="text-[10px] font-bold uppercase text-gray-400">Select Flavor:</label>
                        <select id="flavor-${product._id}" class="w-full mt-1 bg-gray-50 border border-gray-200 text-xs font-bold uppercase p-2 rounded-none focus:border-black outline-none">
                            ${options}
                        </select>
                    </div>
                `;
            } else {
                flavorHtml = `<p class="mt-3 text-[10px] text-gray-400 uppercase font-bold">Standard Flavor</p>`;
            }

            return `
            <div class="group relative fade-enter">
                <div class="aspect-square bg-brand-gray overflow-hidden relative mb-4">
                    <img src="${product.imageUrl || 'https://placehold.co/400x400?text=No+Image'}" 
                         class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-500"
                         alt="${product.name}">
                    
                    ${onSale ? `<span class="absolute top-2 right-2 bg-brand-sale text-white text-[10px] font-bold px-2 py-1 uppercase tracking-widest">-${product.discount}%</span>` : ''}
                </div>

                <div class="space-y-1">
                    <div class="flex justify-between items-start">
                        <h3 class="font-black text-sm uppercase tracking-tight leading-none">${product.name}</h3>
                        <div class="text-right">
                             ${onSale ? `<span class="text-xs text-gray-400 line-through block">KES ${product.price}</span>` : ''}
                             <span class="font-bold text-sm">KES ${finalPrice}</span>
                        </div>
                    </div>
                    
                    <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">
                        ${product.brand} • ${product.puffCount} Puffs
                        ${product.nicotine ? `• <span class="text-black">${product.nicotine}</span>` : ''}
                    </p>

                    ${flavorHtml}

                    <button onclick="window.app.addToCart('${product._id}')" 
                            class="w-full mt-4 bg-brand-black text-white py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition active:scale-95">
                        Add to Bag
                    </button>
                </div>
            </div>
            `;
        }).join('');
    },

    // --- CART FUNCTIONS ---
    addToCart(id) {
        const product = this.products.find(p => p._id === id);
        if (!product) return;

        // Get Selected Flavor
        let selectedFlavor = 'Default';
        const flavorSelect = document.getElementById(`flavor-${id}`);
        if (flavorSelect) {
            selectedFlavor = flavorSelect.value;
        }

        // Create Unique ID based on Product + Flavor
        const cartItemId = `${id}-${selectedFlavor}`;
        const existingItem = this.cart.find(item => item.cartId === cartItemId);

        if (existingItem) {
            existingItem.qty++;
        } else {
            const finalPrice = product.discount > 0 
                ? Math.round(product.price * ((100 - product.discount) / 100)) 
                : product.price;

            this.cart.push({
                cartId: cartItemId,
                productId: product._id,
                name: product.name,
                brand: product.brand,
                flavor: selectedFlavor, // Save the flavor
                price: finalPrice,
                qty: 1,
                image: product.imageUrl
            });
        }

        this.updateCartUI();
        this.showToast();
    },

    removeFromCart(cartId) {
        this.cart = this.cart.filter(item => item.cartId !== cartId);
        this.updateCartUI();
    },

    updateCartUI() {
        const cartContainer = document.getElementById('cart-items');
        const countBadge = document.getElementById('cart-count');
        const totalEl = document.getElementById('cart-total');
        
        // Update Count
        const totalQty = this.cart.reduce((sum, item) => sum + item.qty, 0);
        countBadge.innerText = totalQty;
        countBadge.classList.toggle('hidden', totalQty === 0);

        // Update Total
        const totalPrice = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        totalEl.innerText = `KES ${totalPrice.toLocaleString()}`;

        // Render Items
        if (this.cart.length === 0) {
            cartContainer.innerHTML = '<p class="text-center text-gray-400 text-xs uppercase tracking-widest mt-10">Your bag is empty</p>';
            return;
        }

        cartContainer.innerHTML = this.cart.map(item => `
            <div class="flex gap-4">
                <div class="w-16 h-16 bg-gray-100 flex-shrink-0">
                    <img src="${item.image}" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-xs uppercase">${item.name}</h4>
                            <p class="text-[10px] text-gray-500 uppercase mt-1">Flavor: ${item.flavor}</p>
                            <p class="text-[10px] text-gray-500 uppercase">${item.brand}</p>
                        </div>
                        <button onclick="window.app.removeFromCart('${item.cartId}')" class="text-gray-300 hover:text-red-500">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                    <div class="flex justify-between items-end mt-2">
                        <span class="text-xs font-bold">x${item.qty}</span>
                        <span class="text-xs font-bold">KES ${(item.price * item.qty).toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `).join('');

        this.saveCart();
    },

    // --- UI HELPERS ---
    toggleCart() {
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('cart-overlay');
        const isOpen = !drawer.classList.contains('translate-x-full');
        
        if (isOpen) {
            drawer.classList.add('translate-x-full');
            overlay.classList.add('hidden');
            overlay.classList.remove('opacity-100');
            document.body.classList.remove('modal-open');
        } else {
            drawer.classList.remove('translate-x-full');
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.add('opacity-100'), 10);
            document.body.classList.add('modal-open');
        }
    },

    toggleContact() {
        document.getElementById('contact-modal').classList.toggle('hidden');
    },

    toggleFAQ() {
        document.getElementById('faq-modal').classList.toggle('hidden');
    },

    toggleTerms() {
        document.getElementById('terms-modal').classList.toggle('hidden');
    },

    handleSearch(query) {
        const lower = query.toLowerCase();
        const filtered = this.products.filter(p => 
            p.name.toLowerCase().includes(lower) || 
            p.brand.toLowerCase().includes(lower) ||
            (p.flavors && p.flavors.some(f => f.toLowerCase().includes(lower)))
        );
        this.renderProducts(filtered);
    },

    handleFilter() {
        const brand = document.getElementById('filter-brand').value;
        const puff = document.getElementById('filter-puffs').value;
        const price = document.getElementById('filter-price').value;

        let filtered = this.products;

        if (brand !== 'all') filtered = filtered.filter(p => p.brand === brand);
        // Add more logic if needed
        
        // Simple price filter
        if (price === 'low') filtered = filtered.filter(p => p.price < 1500);
        if (price === 'mid') filtered = filtered.filter(p => p.price >= 1500 && p.price <= 2500);
        if (price === 'high') filtered = filtered.filter(p => p.price > 2500);
        if (price === 'sale') filtered = filtered.filter(p => p.discount > 0);

        this.renderProducts(filtered);
    },
    
    resetFilters() {
        document.getElementById('search').value = '';
        document.getElementById('filter-brand').value = 'all';
        document.getElementById('filter-price').value = 'all';
        this.renderProducts(this.products);
    },

    showToast() {
        const toast = document.getElementById('toast');
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, 20px)';
        }, 2000);
    },

    saveCart() {
        localStorage.setItem('jvapes_cart', JSON.stringify(this.cart));
    },

    loadCart() {
        const saved = localStorage.getItem('jvapes_cart');
        if (saved) {
            this.cart = JSON.parse(saved);
            this.updateCartUI();
        }
    },

    checkout() {
        if (this.cart.length === 0) return;

        let message = `*NEW ORDER - J_VAPES.KE*\n\n`;
        this.cart.forEach(item => {
            message += `▫️ ${item.name}\n   Flavor: ${item.flavor}\n   Qty: ${item.qty} x ${item.price}\n\n`;
        });

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        message += `*TOTAL ESTIMATE: KES ${total.toLocaleString()}*\n`;
        message += `--------------------------\n`;
        message += `📍 Location: \n`;
        message += `Delivery is approx 100-400 KES depending on location.`;

        const url = `https://wa.me/254741658556?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
    
    // Age Gate Logic
    if (!localStorage.getItem('age_verified')) {
        document.getElementById('age-gate').classList.remove('hidden');
    } else {
        document.getElementById('age-gate').classList.add('hidden');
    }

    document.getElementById('btn-yes').addEventListener('click', () => {
        localStorage.setItem('age_verified', 'true');
        document.getElementById('age-gate').classList.add('hidden');
    });

    document.getElementById('btn-no').addEventListener('click', () => {
        document.getElementById('age-error').classList.remove('hidden');
    });
});