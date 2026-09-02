/*
 * 🌟 MEITU & WINK VIP ULTIMATE 2026 (LacVietMedia)
 * Supports: Wink, Meitu, BeautyCam, Xingtu, Hypic
 * Features: Auto-inject VIP, Super VIP, 4K/60fps, AI tools, Permanent License
 */

(function () {
  const url = $request.url;
  let body = $response.body;

  if (!body) {
    $done({});
    return;
  }

  try {
    let obj = JSON.parse(body);

    const now = Math.floor(Date.now() / 1000);
    const expireTimestamp = 4092599349; // Year 2099
    const expireDateStr = "2099-12-31 23:59:59";
    const expireShort = "2099-12-31";

    function patchVipObject(o) {
      if (!o || typeof o !== 'object') return;

      // Status codes
      o.is_vip = true;
      o.is_valid_vip = true;
      o.is_sub_valid = true;
      o.is_permanent_vip = true;
      o.is_permanent = true;
      o.is_lifetime = true;
      o.have_vip = true;
      o.vip = true;
      o.vip_type = 2; // 2 = Super VIP / Ultimate VIP
      o.vip_level = 2;
      o.vip_status = 1;
      o.status = 1;
      o.state = 1;
      o.is_subscriber = true;
      o.in_trial_period = false;

      // Timestamps
      o.valid_time = expireTimestamp * 1000;
      o.expire_time = expireDateStr;
      o.expire_date = expireShort;
      o.expire_time_ms = expireTimestamp * 1000;
      o.expired_at = expireDateStr;
      o.end_time = expireDateStr;
      o.period_type = "lifetime";
      o.subscription_period = "lifetime";

      // Product & rights
      o.product_id = "com.meitu.wink.vip.lifetime";
      o.package_id = "vip_lifetime";
      o.order_id = "730002675608342";
    }

    // Recursively patch data structures
    if (obj.data) {
      patchVipObject(obj.data);
      if (obj.data.vip_info) patchVipObject(obj.data.vip_info);
      if (obj.data.user) patchVipObject(obj.data.user);
      if (obj.data.subscriber) patchVipObject(obj.data.subscriber);
      if (obj.data.super_vip) patchVipObject(obj.data.super_vip);
      if (obj.data.account) patchVipObject(obj.data.account);
      if (obj.data.rights && Array.isArray(obj.data.rights)) {
        obj.data.rights.forEach(r => patchVipObject(r));
      }
      if (obj.data.memberships && Array.isArray(obj.data.memberships)) {
        obj.data.memberships.forEach(m => patchVipObject(m));
      }
    }

    if (obj.vip_info) patchVipObject(obj.vip_info);
    if (obj.user) patchVipObject(obj.user);
    if (obj.subscriber) patchVipObject(obj.subscriber);
    if (obj.response && obj.response.data) patchVipObject(obj.response.data);

    // Ensure status code 0 / 200
    if (typeof obj.code !== 'undefined') obj.code = 0;
    if (typeof obj.status !== 'undefined' && obj.status !== 200) obj.status = 200;

    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    $done({ body });
  }
})();
