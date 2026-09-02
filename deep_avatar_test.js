async function testHangDeep() {
  const username = 'hang1709';
  console.log('--- KIỂM TRA TẤT CẢ NGUỒN AVATAR CHO @' + username + ' ---');

  // 1. Check vanduc get_avatar
  try {
    const r1 = await fetch('https://vanduc.info.vn/locket/get_avatar.php?username=' + username);
    const d1 = await r1.json();
    console.log('Vanduc API Avatar:', d1);
  } catch(e) {
    console.log('Vanduc API Error:', e.message);
  }

  // 2. Check full HTML from locket.cam/hang1709
  try {
    const r2 = await fetch('https://locket.cam/' + username, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      }
    });
    const html = await r2.text();
    console.log('Locket.cam HTML snippet:', html);
  } catch(e) {
    console.log('Locket.cam Error:', e.message);
  }
}
testHangDeep();
