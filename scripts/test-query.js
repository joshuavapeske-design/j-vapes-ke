const https = require('https');

const query = `{
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
}`;

const url = `https://pkrx1c35.api.sanity.io/v2021-10-21/data/query/production?query=${encodeURIComponent(query)}`;

https.get(url, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        try {
            const parsed = JSON.parse(data);
            console.log('Result Products Length:', parsed.result?.products?.length);
            console.log('First Product:', parsed.result?.products?.[0]?.name);
        } catch(e) {
            console.error('Parse error:', data);
        }
    });
}).on('error', err => {
    console.error('HTTPS Error:', err);
});
