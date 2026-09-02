/*
 * Meitu & Wink All-In-One VIP Unlock Script (LacVietMedia)
 * Supports: Meitu, Wink, BeautyCam, Xingtu
 */

let body = $response.body;
if (body) {
  try {
    let obj = JSON.parse(body);

    // 1. Generic VIP data injector
    function grantVip(target) {
      if (!target || typeof target !== 'object') return;
      target.is_vip = true;
      target.is_valid_vip = true;
      target.is_sub_valid = true;
      target.vip_type = 1;
      target.vip_status = 1;
      target.status = 1;
      target.expire_time = "2099-12-31 23:59:59";
      target.expire_date = "2099-12-31";
      target.valid_time = 4092599349;
      target.in_trial_period = false;
      target.is_lifetime = true;
      target.have_vip = true;
      target.vip = true;
    }

    // Process top-level and data container
    if (obj.data) {
      grantVip(obj.data);
      if (obj.data.user) grantVip(obj.data.user);
      if (obj.data.vip_info) grantVip(obj.data.vip_info);
      if (obj.data.subscriber) grantVip(obj.data.subscriber);
    }
    if (obj.user) grantVip(obj.user);
    if (obj.vip_info) grantVip(obj.vip_info);
    if (obj.response && obj.response.data) grantVip(obj.response.data);

    $done({ body: JSON.stringify(obj) });
  } catch (err) {
    $done({ body });
  }
} else {
  $done({});
}
