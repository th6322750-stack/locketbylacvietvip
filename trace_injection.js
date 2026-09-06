const https = require('https');

const LOCKET_RC_KEY = 'appl_JngFETzdodyLmCREOlwTUtXdQik';
const MASTER_CLUSTER_UID = 'VBo5nZiVs4ee3JIyV9L5zlijIa23';
const TARGET_UID = 'dalObdmoDORgzRwrXJWITU3oQ0N2'; // @thtrungg210
const DEFAULT_MASTER_JWS_TOKEN = 'eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlFTVRDQ0E3YWdBd0lCQWdJUVI4S0h6ZG41NTRaL1VvcmFkTng5dHpBS0JnZ3Foa2pPUFFRREF6QjFNVVF3UWdZRFZRUURERHRCY0hCc1pTQlhiM0pzWkhkcFpHVWdSR1YyWld4dmNHVnlJRkpsYkdGMGFXOXVjeUJEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURUxNQWtHQTFVRUN3d0NSell4RXpBUkJnTlZCQW9NQ2tGd2NHeGxJRWx1WXk0eEN6QUpCZ05WQkFZVEFsVlRNQjRYRFRJMU1Ea3hPVEU1TkRRMU1Wb1hEVEkzTVRBeE16RTNORGN5TTFvd2daSXhRREErQmdOVkJBTU1OMUJ5YjJRZ1JVTkRJRTFoWXlCQmNIQWdVM1J2Y21VZ1lXNWtJR2xVZFc1bGN5QlRkRzl5WlNCU1pXTmxhWEIwSUZOcFoyNXBibWN4TERBcUJnTlZCQXNNSTBGd2NHeGxJRmR2Y214a2QybGtaU0JFWlhabGJHOXdaWElnVW1Wc1lYUnBiMjV6TVJNd0VRWURWUVFLREFwQmNIQnNaU0JKYm1NdU1Rc3dDUVlEVlFRR0V3SlZVekJaTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEEwSUFCTm5WdmhjdjdpVCs3RXg1dEJNQmdyUXNwSHpJc1hSaTBZeGZlazdsdjh3RW1qL2JIaVd0TndKcWMyQm9IenNRaUVqUDdLRklJS2c0WTh5MC9ueW51QW1qZ2dJSU1JSUNCREFNQmdOVkhSTUJBZjhFQWpBQU1COEdBMVVkSXdRWU1CYUFGRDh2bENOUjAxREptaWc5N2JCODVjK2xrR0taTUhBR0NDc0dBUVVGQndFQkJHUXdZakF0QmdnckJnRUZCUWN3QW9ZaGFIUjBjRG92TDJObGNuUnpMbUZ3Y0d4bExtTnZiUzkzZDJSeVp6WXVaR1Z5TURFR0NDc0dBUVVGQnpBQmhpVm9kSFJ3T2k4dmIyTnpjQzVoY0hCc1pTNWpiMjB2YjJOemNEQXpMWGQzWkhKbk5qQXlNSUlCSGdZRFZSMGdCSUlCRlRDQ0FSRXdnZ0VOQmdvcWhraUc5Mk5rQlFZQk1JSCtNSUhEQmdnckJnRUZCUWNDQWpDQnRneUJzMUpsYkdsaGJtNmxJRzl1SUhSb2FYTWdZMlZ5ZEdsbWFXTmhkR1VnWW5rZ1lXNTVJSEJoY25SNUlHRnpjM1Z0WlhNZ1lXTmpaWEIwWVc1alpTQnZaaUIwYUdVZ2RHaGxiaUJoY0hCc2FXTmhZbXhsSUhOMFlXNWtZWEprSUhSbGNtMXpJR0Z1WkNCamIyNWthWFJwYjI1eklHOW1JSFZ6WlN3Z1kyVnlkR2xtYVdOaGRHVWdjRzlzYVdONUlHRnVaQ0JqWlhKMGFXWnBZMkYwYVc5dUlIQnlZV04wYVdObElITjBZWFJsYldWdWRITXVNRFlHQ0NzR0FRVUZCd0lCRmlwb2RIUndPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOWpaWEowYVdacFkyRjBaV0YxZEdodmNtbDBlUzh3SFFZRFZSME9CQllFRklGaW9HNHdNTVZBMWt1OXpKbUdOUEFWbjNlcU1BNEdBMVVkRHdFQi93UUVBd0lIZ0RBUUJnb3Foa2lHOTJOa0Jnc0JCQUlGQURBS0JnZ3Foa2pPUFFRREF3TnBBREJtQWpFQStxWG5SRUM3aFhJV1ZMc0x4em5qUnBJelBmN1ZIejlWL0NUbTgrTEpsclFlcG5tY1B2R0xOY1g2WFBubGNnTEFBakVBNUlqTlpLZ2c1cFE3OWtuRjRJYlRYZEt2OHZ1dElETVhEbWpQVlQzZEd2RnRzR1J3WE95d1Iya1pDZFNyZmVvdCIsIk1JSURGakNDQXB5Z0F3SUJBZ0lVSXNHaFJ3cDBjMm52VTRZU3ljYWZQVGp6Yk5jd0NnWUlLb1pJemowRUF3TXdaekViTUJrR0ExVUVBd3dTUVhCd2JHVWdVbTl2ZENCRFFTQXRJRWN6TVNZd0pBWURWUVFMREIxQmNIQnNaU0JEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd0hoY05NakV3TXpFM01qQXpOekV3V2hjTk16WXdNekU1TURBd01EQXdXakIxTVVRd1FnWURWUVFERER0QmNIQnNaU0JYYjNKc1pIZHBaR1VnUkdWMlpXeHZjR1Z5SUZKbGJHRjBhVzl1Y3lCRFpYSjBhV1pwWTJGMGFXOXVJRUYxZEdodmNtbDBlVEVMTUFrR0ExVUVDd3dDUnpZeEV6QVJCZ05WQkFvTUNrRndjR3hsSUVsdVl5NHhDekFKQmdOVkJBWVRBbFZUTUhZd0VBWUhLb1pJemowQ0FRWUZLNEVFQUNJRFlnQUVic1FLQzk0UHJsV21aWG5YZ3R4emRWSkw4VDBTR1luZ0RSR3BuZ24zTjZQVDhKTUViN0ZEaTRiQm1QaENuWjMvc3E2UEYvY0djS1hXc0w1dk90ZVJoeUo0NXgzQVNQN2NPQithYW85MGZjcHhTdi9FWkZibmlBYk5nWkdoSWhwSW80SDZNSUgzTUJJR0ExVWRFd0VCL3dRSU1BWUJBZjhDQVFBd0h3WURWUjBqQkJnd0ZvQVV1N0Rlb1ZnemlKcWtpcG5ldnIzcnI5ckxKS3N3UmdZSUt3WUJCUVVIQVFFRU9qQTRNRFlHQ0NzR0FRVUZCekFCaGlwb2RIUndPaTh2YjJOemNDNWhjSEJzWlM1amIyMHZiMk56Y0RBekxXRndjR3hsY205dmRHTmhaek13TndZRFZSMGZCREF3TGpBc29DcWdLSVltYUhSMGNEb3ZMMk55YkM1aGNIQnNaUzVqYjIwdllYQndiR1Z5YjI5MFkyRm5NeTVqY213d0hRWURWUjBPQkJZRUZEOHZsQ05SMDFESm1pZzk3YkI4NWMrbGtHS1pNQTRHQTFVZER3RUIvd1FFQXdJQkJqQVFCZ29xaGtpRzkyTmtCZ0lCQkFJRkFEQUtCZ2dxaGtqT1BRUURBd05vQURCbEFqQkFYaFNxNUl5S29nTUNQdHc0OTBCYUI2NzdDYUVHSlh1ZlFCL0VxWkdkNkNTamlDdE9udU1UYlhWWG14eGN4ZmtDTVFEVFNQeGFyWlh2TnJreFUzVGtVTUkzM3l6dkZWVlJUNHd4V0pDOTk0T3NkY1o0K1JHTnNZRHlSNWdtZHIwbkRHZz0iLCJNSUlDUXpDQ0FjbWdBd0lCQWdJSUxjWDhpTkxGUzVVd0NnWUlLb1pJemowRUF3TXdaekViTUJrR0ExVUVBd3dTUVhCd2JHVWdVbTl2ZENCRFFTQXRJRWN6TVNZd0pBWURWUVFMREIxQmNIQnNaU0JEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd0hoY05NVFF3TkRNd01UZ3hPVEEyV2hjTk16a3dORE13TVRneE9UQTJXakJuTVJzd0dRWURWUVFEREJKQmNIQnNaU0JTYjI5MElFTkJJQzBnUnpNeEpqQWtCZ05WQkFzTUhVRndjR3hsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNUk13RVFZRFZRUUtEQXBCY0hCc1pTQkpibU11TVFzd0NRWURWUVFHRXdKVlV6QjJNQkFHQnlxR1NNNDlBZ0VHQlN1QkJBQWlBMklBQkpqcEx6MUFjcVR0a3lKeWdSTWMzUkNWOGNXalRuSGNGQmJaRHVXbUJTcDNaSHRmVGpqVHV4eEV0WC8xSDdZeVlsM0o2WVJiVHpCUEVWb0EvVmhZREtYMUR5eE5CMGNUZGRxWGw1ZHZNVnp0SzUxN0lEdll1VlRaWHBta09sRUtNYU5DTUVBd0hRWURWUjBPQkJZRUZMdXczcUZZTTRpYXBJcVozcjY5NjYvYXl5U3JNQThHQTFVZEV3RUIvd1FGTUFNQkFmOHdEZ1lEVlIwUEFRSC9CQVFEQWdFR01Bb0dDQ3FHU000OUJBTURBMmdBTUdVQ01RQ0Q2Y0hFRmw0YVhUUVkyZTN2OUd3T0FFWkx1Tit5UmhIRkQvM21lb3locG12T3dnUFVuUFdUeG5TNGF0K3FJeFVDTUcxbWloREsxQTNVVDgyTlF6NjBpbU9sTTI3amJkb1h0MlFmeUZNbStZaGlkRGtMRjF2TFVhZ002QmdENTZLeUtBPT0iXX0.eyJ0cmFuc2FjdGlvbklkIjoiNTEwMDAyODM2ODQwNTY2Iiwib3JpZ2luYWxUcmFuc2FjdGlvbklkIjoiNTEwMDAyODM2ODQwNTY2Iiwid2ViT3JkZXJMaW5lSXRlbUlkIjoiNTEwMDAxMjcwMzAxOTQ1IiwiYnVuZGxlSWQiOiJjb20ubG9ja2V0LkxvY2tldCIsInByb2R1Y3RJZCI6ImxvY2tldF8xOTlfMW0iLCJzdWJzY3JpcHRpb25Hcm91cElkZW50aWZpZXIiOiIyMTQxOTQ0NyIsInB1cmNoYXNlRGF0ZSI6MTc4ODQzNDc4NjAwMCwib3JpZ2luYWxQdXJjaGFzZURhdGUiOjE3ODg0MzQ3ODYwMDAsImV4cGlyZXNEYXRlIjoxNzkxMDI2Nzg2MDAwLCJxdWFudGl0eSI6MSwidHlwZSI6IkF1dG8tUmVuZXdhYmxlIFN1YnNjcmlwdGlvbiIsImRldmljZVZlcmlmaWNhdGlvbiI6Ikdpamt0NG9OR1podlUwYUw5QmRBbXZXdTBob1hmclB6NnN4U2VmR1k0dnBQQ0NSejBQZUI1ZXYvTnd6bndLRGIiLCJkZXZpY2VWZXJpZmljYXRpb25Ob25jZSI6IjQyZWE0YThkLTY0YWItNDZiMS05M2U0LWNjZDAzMjRmYzI0ZCIsImluQXBwT3duZXJzaGlwVHlwZSI6IlBVUkNIQVNFRCIsInNpZ25lZERhdGUiOjE3ODg0MzQ4MzUyOTMsImVudmlyb25tZW50IjoiUHJvZHVjdGlvbiIsInRyYW5zYWN0aW9uUmVhc29uIjoiUFVSQ0hBU0UiLCJzdG9yZWZyb250IjoiVk5NIiwic3RvcmVmcm9udElkIjoiMTQzNDcxIiwicHJpY2UiOjQ5MDAwMDAwLCJjdXJyZW5jeSI6IlZORCIsImFwcFRyYW5zYWN0aW9uSWQiOiI3MDU4NTI3MDU3MDQ5NjMzNjYiLCJiaWxsaW5nUGxhblR5cGUiOiJCSUxMRURfVVBGUk9OVCJ9.GaxwQwDtoDjNZIw_wtJvGcRBdRxNWvrMuuqP_lXV4Sl00z7XyCFKr5qNll1XHCrYs3l37LR3rjHjZb5qwggp0g';

function makeRequest(options, data = null) {
  return new Promise((resolve) => {
    const postData = data ? JSON.stringify(data) : null;
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    req.on('error', (err) => resolve({ statusCode: 500, error: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU BƠM LẠI & THEO DÕI TOÀN BỘ REQUEST CHO @thtrungg210');
  console.log('Target UID:', TARGET_UID);
  console.log('================================================================\n');

  // BƯỚC 1: Thử gộp Alias vào Cụm Master 01
  console.log('👉 [BƯỚC 1]: GỌI API GỘP ALIAS VÀO CỤM MASTER 01');
  console.log('POST https://api.revenuecat.com/v1/subscribers/' + MASTER_CLUSTER_UID + '/alias');
  const aliasPayload = { new_app_user_id: TARGET_UID };
  console.log('Headers: Authorization: Bearer ' + LOCKET_RC_KEY.substring(0, 10) + '... | Content-Type: application/json');
  console.log('Payload:', JSON.stringify(aliasPayload));

  const aliasRes = await makeRequest({
    hostname: 'api.revenuecat.com',
    path: '/v1/subscribers/' + encodeURIComponent(MASTER_CLUSTER_UID) + '/alias',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + LOCKET_RC_KEY,
      'Content-Type': 'application/json',
      'X-Platform': 'ios',
      'Content-Length': Buffer.byteLength(JSON.stringify(aliasPayload))
    }
  }, aliasPayload);

  console.log('\n📥 KẾT QUẢ BƯỚC 1 (Từ RevenueCat):');
  console.log('HTTP Status Code:', aliasRes.statusCode);
  console.log('Body Response:', aliasRes.body.trim());

  if (aliasRes.statusCode !== 200) {
    console.log('\n⚠️ Nhận xét: RevenueCat TỪ CHỐI gộp Alias do Cụm 01 đã kịch trần 50 Aliases.');
    console.log('👉 Hệ thống buộc phải chuyển sang BƯỚC 2: Bơm trực tiếp bằng Token StoreKit 2.');
  }

  // BƯỚC 2: Bơm trực tiếp bằng /v1/receipts
  console.log('\n----------------------------------------------------------------');
  console.log('👉 [BƯỚC 2]: GỌI API BƠM TRỰC TIẾP TOKEN STOREKIT 2 (FALLBACK)');
  console.log('POST https://api.revenuecat.com/v1/receipts');
  const receiptPayload = {
    app_user_id: TARGET_UID,
    fetch_token: DEFAULT_MASTER_JWS_TOKEN,
    price: 3.99,
    currency: "USD",
    is_restore: true,
    attributes: {
      "storefront": { value: "VNM" },
      "app_version": { value: "1.144.0" },
      "platform": { value: "iOS" }
    }
  };
  console.log('Payload app_user_id:', receiptPayload.app_user_id);
  console.log('Payload fetch_token:', receiptPayload.fetch_token.substring(0, 40) + '... (StoreKit 2 JWS)');

  const receiptRes = await makeRequest({
    hostname: 'api.revenuecat.com',
    path: '/v1/receipts',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + LOCKET_RC_KEY,
      'Content-Type': 'application/json',
      'X-Platform': 'ios',
      'Content-Length': Buffer.byteLength(JSON.stringify(receiptPayload))
    }
  }, receiptPayload);

  console.log('\n📥 KẾT QUẢ BƯỚC 2 (Từ RevenueCat):');
  console.log('HTTP Status Code:', receiptRes.statusCode);
  try {
    const json = JSON.parse(receiptRes.body);
    console.log('Subscriber Status:', json.subscriber ? 'Tạo/Cập nhật thành công' : 'Thất bại');
    console.log('Entitlements Gold nhận được:', JSON.stringify(json.subscriber?.entitlements?.Gold, null, 2));
  } catch(e) {
    console.log('Raw Body:', receiptRes.body);
  }

  // BƯỚC 3: Quét kiểm tra trạng thái thực tế sau khi bơm
  console.log('\n----------------------------------------------------------------');
  console.log('👉 [BƯỚC 3]: KIỂM TRA GET SUBSCRIBER XÁC THỰC LẠI');
  console.log('GET https://api.revenuecat.com/v1/subscribers/' + TARGET_UID);

  const checkRes = await makeRequest({
    hostname: 'api.revenuecat.com',
    path: '/v1/subscribers/' + encodeURIComponent(TARGET_UID),
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + LOCKET_RC_KEY,
      'X-Platform': 'ios'
    }
  });

  console.log('\n📥 KẾT QUẢ BƯỚC 3:');
  console.log('HTTP Status Code:', checkRes.statusCode);
  const finalJson = JSON.parse(checkRes.body);
  console.log('Tài khoản:', TARGET_UID);
  console.log('Original App User ID:', finalJson.subscriber?.original_app_user_id);
  console.log('Quyền Gold hiện tại:', JSON.stringify(finalJson.subscriber?.entitlements?.Gold, null, 2));
  console.log('Chi tiết gói đăng ký:', JSON.stringify(finalJson.subscriber?.subscriptions, null, 2));
  console.log('\n================================================================');
  console.log('✅ HOÀN TẤT THỬ NGHIỆM BƠM TRỰC TIẾP!');
  console.log('================================================================');
})();
