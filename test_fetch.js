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
    
    // Check for profile image in HTML
    const profileImgMatch = html.match(/class="profile-pic-img"\s+src="([^"]+)"/i) || html.match(/src="([^"]*profile_pic[^"]*)"/i);
    console.log('Profile Pic Match from HTML:', profileImgMatch ? profileImgMatch[1] : 'none');

    // Check for initials
    const initialsMatch = html.match(/class="profile-pic-initials">([^<]+)<\/h2>/i);
    console.log('Initials:', initialsMatch ? initialsMatch[1] : 'none');

    // Check Firebase UID
    const inviteMatch = html.match(/invites(?:%2F|\/)([a-zA-Z0-9_-]{28})/i);
    console.log('Invite UID:', inviteMatch ? inviteMatch[1] : 'none');
  } catch (e) {
    console.error('Error:', e);
  }
}
fetchLocketWeb('hang1709');
