
const https = require('https');

const apiKey = 'AQ.Ab8RN6LXxm4PmlvYdXTbY-gqxs6vIDNIeqU9dcmFiutztLNBrQ';
const data = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
        name: 'list_projects',
        arguments: {
            filter: 'view=owned'
        }
    }
});

const options = {
    hostname: 'stitch.googleapis.com',
    port: 443,
    path: '/mcp',
    method: 'POST',
    headers: {
        'X-Goog-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
        responseData += chunk;
    });
    res.on('end', () => {
        console.log(responseData);
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.write(data);
req.end();
