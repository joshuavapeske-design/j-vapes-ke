const https = require('https');

function checkCors(origin) {
    const req = https.request('https://pkrx1c35.api.sanity.io/v2021-10-21/data/query/production?query=' + encodeURIComponent('*[_type=="product"][0]'), {
        method: 'OPTIONS',
        headers: {
            'Origin': origin,
            'Access-Control-Request-Method': 'GET'
        }
    }, res => {
        console.log('Origin:', origin, '-> Status:', res.statusCode, '-> Access-Control-Allow-Origin:', res.headers['access-control-allow-origin']);
    });
    req.end();
}

checkCors('http://localhost:5000');
checkCors('http://localhost:3000');
checkCors('http://localhost:3333');
checkCors('http://127.0.0.1:5500');
checkCors('http://localhost:5173');
checkCors('https://jvapes.store');
checkCors('https://jvapes-staging-v2.vercel.app');
