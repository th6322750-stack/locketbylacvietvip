async function fetchLocketWeb(username) {
  const url = 'https://locket.cam/' + username;
  console.log('Fetching:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML Length:', html.length);
    
    // Look for firebase uid or og:image in html
    const uidMatch = html.match(/users(?:%2F|\/)([a-zA-Z0-9_-]{20,40})(?:%2F|\/)public/i);
    console.log('UID from HTML:', uidMatch ? uidMatch[1] : 'null');
    
    const ogImage = html.match(/og:image[^\>]+content="([^"]+)"/i);
    console.log('OG Image:', ogImage ? ogImage[1] : 'null');
    console.log('Body:', html);
  } catch (e) {
    console.error('Error:', e);
  }
}
fetchLocketWeb('lucifervpvp');
