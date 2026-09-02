const https = require('https');

const query = `*[_type=="product"]{ _id, name, productType, price, stock }`;
const url = `https://pkrx1c35.api.sanity.io/v2021-10-21/data/query/production?query=${encodeURIComponent(query)}`;

https.get(url, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const parsed = JSON.parse(data);
        console.log(JSON.stringify(parsed.result, null, 2));
    });
});
