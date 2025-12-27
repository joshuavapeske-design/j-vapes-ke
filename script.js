import { createClient } from 'https://esm.sh/@sanity/client';

const app = {
    data: [],
    cart: [],
    sanity: null,
    
    filter: { search: '', brand: 'all', puffs: 'all', price: 'all' },
    // NOTE: WhatsApp requires international format (254...) without the '+'
    config: { phone: '254741658556' }, 

    // ===== 1. INIT =====
    async init() {
        console.log("🚀 App Starting...");
        try {
            this.sanity = createClient({
                projectId: '2aveaa71',
                dataset: 'production',
                useCdn: true,
                apiVersion: '2023-01-01'
            });

            const query = `*[_type == "disposable"]{
                "id": _id,
                name,
                brand,
                "puffs": string(puffCount), 
                price,
                discount,
                "img": image.asset->url
            }`;

            const result = await this.sanity.fetch(query);
            console.log("☁️ Data Received:", result.length);
            this.data = result;
            this.populateDropdowns();
            this.renderStore();

        } catch (err) {
            console.error("❌ Error:", err);
            document.getElementById('product-grid').innerHTML = 
                `<p class="text-red-500 text-xs font-bold uppercase">System Offline. Check Connection.</p>`;
        }
    },

    // ===== 2. RENDER STORE =====
    renderStore() {
        const grid = document.getElementById('product-grid');
        const empty = document.getElementById('empty-state');
        if(!grid) return;

        const filtered = this.data.filter(p => {
            const matchSearch = (p.name + p.brand).toLowerCase().includes(this.filter.search.toLowerCase());
            const matchBrand = this.filter.brand === 'all' || p.brand === this.filter.brand;
            const matchPuffs = this.filter.puffs === 'all' || p.puffs === this.filter.puffs;
            const finalPrice = p.discount ? Math.round(p.price * (1 - p.discount/100)) : p.price;
            
            let matchPrice = true;
            if(this.filter.price === 'low') matchPrice = finalPrice < 1500;
            if(this.filter.price === 'mid') matchPrice = finalPrice >= 1500 && finalPrice <= 2500;
            if(this.filter.price === 'high') matchPrice = finalPrice > 2500;
            if(this.filter.price === 'sale') matchPrice = p.discount > 0;
            
            return matchSearch && matchBrand && matchPuffs && matchPrice;
        });

        if (filtered.length === 0) {
            grid.innerHTML = '';
            if(empty) { empty.classList.remove('hidden'); empty.classList.add('flex'); }
            return;
        }

        if(empty) empty.classList.add('hidden');

        grid.innerHTML = filtered.map(p => {
            const hasDiscount = p.discount && p.discount > 0;
            const finalPrice = hasDiscount ? Math.round(p.price * (1 - p.discount/100)) : p.price;
            
            return `
            <div class="group relative cursor-pointer fade-enter">
                <div class="aspect-[4/5] bg-brand-gray overflow-hidden mb-4 relative rounded-sm">
                    <img src="${p.img || 'https://via.placeholder.com/400x500?text=No+Image'}" 
                         class="w-full h-full object-cover mix-blend-multiply transition duration-700 group-hover:scale-110 grayscale group-hover:grayscale-0">
                    <div class="absolute top-2 left-2 flex flex-col items-start gap-1">
                        <span class="bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm border border-gray-100">${p.brand}</span>
                        <span class="bg-black text-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm">${p.puffs} PUFFS</span>
                    </div>
                    ${hasDiscount ? `<div class="absolute top-2 right-2 bg-brand-sale text-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm">-${p.discount}%</div>` : ''}
                    <button onclick="window.app.addToCart('${p.id}')" class="absolute bottom-0 right-0 w-12 h-12 bg-black text-white flex items-center justify-center translate-y-full group-hover:translate-y-0 transition duration-300 z-10 hover:bg-gray-800">
                        <i class="fa-solid fa-plus text-xl"></i>
                    </button>
                </div>
                <h3 class="text-sm font-bold uppercase tracking-wider truncate mt-3">${p.name}</h3>
                <div class="flex items-center gap-2 mt-1">
                    <p class="text-xs ${hasDiscount ? 'text-brand-sale' : 'text-gray-500'} font-bold">KES ${finalPrice.toLocaleString()}</p>
                    ${hasDiscount ? `<p class="text-[10px] text-gray-400 font-bold line-through">KES ${p.price.toLocaleString()}</p>` : ''}
                </div>
            </div>`;
        }).join('');
    },

    // ===== 3. FILTERS =====
    populateDropdowns() {
        const brands = [...new Set(this.data.map(i => i.brand))].sort();
        const puffs = [...new Set(this.data.map(i => i.puffs))].sort((a,b) => parseInt(a)-parseInt(b));
        const bSel = document.getElementById('filter-brand');
        const pSel = document.getElementById('filter-puffs');
        if(bSel) bSel.innerHTML = '<option value="all">Brand: All</option>' + brands.map(b => `<option value="${b}">${b}</option>`).join('');
        if(pSel) pSel.innerHTML = '<option value="all">Puffs: All</option>' + puffs.map(p => `<option value="${p}">${p}</option>`).join('');
    },
    handleSearch(val) { this.filter.search = val; this.renderStore(); },
    handleFilter() {
        this.filter.brand = document.getElementById('filter-brand').value;
        this.filter.puffs = document.getElementById('filter-puffs').value;
        this.filter.price = document.getElementById('filter-price').value;
        this.renderStore();
    },
    resetFilters() {
        document.getElementById('search').value = '';
        document.getElementById('filter-brand').value = 'all';
        document.getElementById('filter-puffs').value = 'all';
        document.getElementById('filter-price').value = 'all';
        this.filter = { search: '', brand: 'all', puffs: 'all', price: 'all' };
        this.renderStore();
    },

    // ===== 4. CART & CHECKOUT =====
    addToCart(id) {
        const item = this.data.find(i => i.id === id);
        const existing = this.cart.find(i => i.id === id);
        if (existing) existing.qty++;
        else this.cart.push({ ...item, qty: 1 });
        this.renderCart();
        this.toast(`Added ${item.name}`);
        // Auto open cart
        const drawer = document.getElementById('cart-drawer');
        if (drawer && drawer.classList.contains('translate-x-full')) this.toggleCart();
    },
    updateQty(id, delta) {
        const idx = this.cart.findIndex(i => i.id === id);
        if (idx === -1) return;
        this.cart[idx].qty += delta;
        if (this.cart[idx].qty <= 0) this.cart.splice(idx, 1);
        this.renderCart();
    },
    renderCart() {
        const list = document.getElementById('cart-items');
        const totalEl = document.getElementById('cart-total');
        const countEl = document.getElementById('cart-count');
        const totalQty = this.cart.reduce((a,b) => a+b.qty, 0);

        if(countEl) {
            countEl.innerText = totalQty;
            totalQty > 0 ? countEl.classList.remove('hidden') : countEl.classList.add('hidden');
        }

        if (this.cart.length === 0) {
            if(list) list.innerHTML = '<div class="h-full flex items-center justify-center text-gray-400 text-xs font-bold uppercase tracking-widest">Bag is Empty</div>';
            if(totalEl) totalEl.innerText = 'KES 0';
            return;
        }

        let total = 0;
        list.innerHTML = this.cart.map(i => {
            const finalPrice = i.discount ? Math.round(i.price * (1 - i.discount/100)) : i.price;
            total += finalPrice * i.qty;
            return `
            <div class="flex gap-4">
                <img src="${i.img}" class="w-16 h-20 object-cover bg-brand-gray mix-blend-multiply rounded-sm">
                <div class="flex-1 flex flex-col justify-between py-1">
                    <div>
                        <h4 class="text-xs font-bold uppercase tracking-wider">${i.name}</h4>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">${i.brand} / ${i.puffs}</p>
                    </div>
                    <div class="flex justify-between items-end">
                        <div class="flex items-center border border-gray-200">
                            <button onclick="window.app.updateQty('${i.id}', -1)" class="px-2 py-1 text-xs hover:bg-gray-100">-</button>
                            <span class="text-xs font-bold px-1">${i.qty}</span>
                            <button onclick="window.app.updateQty('${i.id}', 1)" class="px-2 py-1 text-xs hover:bg-gray-100">+</button>
                        </div>
                        <span class="text-xs font-bold">KES ${(finalPrice * i.qty).toLocaleString()}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
        if(totalEl) totalEl.innerText = `KES ${total.toLocaleString()}`;
    },
    toggleCart() {
        const overlay = document.getElementById('cart-overlay');
        const drawer = document.getElementById('cart-drawer');
        if (!overlay || !drawer) return;
        if (overlay.classList.contains('hidden')) {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
            drawer.classList.remove('translate-x-full');
        } else {
            overlay.classList.add('opacity-0');
            drawer.classList.add('translate-x-full');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    },
    checkout() {
        if(this.cart.length === 0) return;
        let msg = "ORDER REQUEST - J_VAPES.KE\n------------------------\n";
        let total = 0;
        this.cart.forEach(i => {
            const finalPrice = i.discount ? Math.round(i.price * (1 - i.discount/100)) : i.price;
            const sub = finalPrice*i.qty;
            total += sub;
            msg += `• ${i.qty}x ${i.brand} ${i.name} (${i.puffs}) - KES ${sub.toLocaleString()}\n`;
        });
        msg += `------------------------\nTOTAL: KES ${total.toLocaleString()}\n\nPAYMENT: M-Pesa / Cash on Delivery\nLOCATION: `;
        window.open(`https://wa.me/${this.config.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    },

    // ===== 5. MODAL HELPERS =====
    toggleTerms() {
        const m = document.getElementById('terms-modal');
        if(m) m.classList.toggle('hidden');
    },
    toggleFAQ() {
        const m = document.getElementById('faq-modal');
        if(m) m.classList.toggle('hidden');
    },
    toggleContact() {
        const m = document.getElementById('contact-modal');
        if(m) m.classList.toggle('hidden');
    },

    toast(msg) {
        const t = document.getElementById('toast');
        if(!t) return;
        t.innerText = msg;
        t.classList.remove('opacity-0', 'translate-y-4');
        t.classList.add('opacity-100', 'translate-y-0');
        setTimeout(() => {
            t.classList.add('opacity-0', 'translate-y-4');
            t.classList.remove('opacity-100', 'translate-y-0');
        }, 2000);
    }
};

// EXPOSE TO WINDOW
window.app = app;

// ===== 6. AGE GATE =====
function setupAgeGate() {
    const ageGate = document.getElementById('age-gate');
    const ageError = document.getElementById('age-error');
    const btnYes = document.getElementById('btn-yes');
    const btnNo = document.getElementById('btn-no');

    if (localStorage.getItem('age_verified') === 'true') {
        if(ageGate) ageGate.classList.add('hidden');
        app.init(); 
        return;
    }

    if (btnYes) {
        btnYes.addEventListener('click', () => {
            if(ageGate) ageGate.classList.add('hidden');
            localStorage.setItem('age_verified', 'true');
            app.init(); 
        });
    }

    if (btnNo) {
        btnNo.addEventListener('click', () => {
            if(ageError) ageError.classList.remove('hidden');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupAgeGate();
});