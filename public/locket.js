const resp = {};
const obj = JSON.parse(typeof $response != "undefined" && $response.body || "{}");
const goldEntitlement = {
  "expires_date": "2026-10-03T11:26:26Z",
  "grace_period_expires_date": null,
  "product_identifier": "locket_199_1m",
  "purchase_date": "2026-09-03T11:26:26Z"
};
const goldSubscription = {
  "auto_resume_date": null,
  "billing_issues_detected_at": null,
  "expires_date": "2026-10-03T11:26:26Z",
  "grace_period_expires_date": null,
  "is_sandbox": false,
  "original_purchase_date": "2026-09-03T11:26:26Z",
  "ownership_type": "PURCHASED",
  "period_type": "normal",
  "purchase_date": "2026-09-03T11:26:26Z",
  "refunded_at": null,
  "store": "app_store",
  "unsubscribe_detected_at": null
};

if (obj.subscriber) {
  obj.subscriber.entitlements = obj.subscriber.entitlements || {};
  obj.subscriber.entitlements["Gold"] = goldEntitlement;
  obj.subscriber.subscriptions = obj.subscriber.subscriptions || {};
  obj.subscriber.subscriptions["locket_199_1m"] = goldSubscription;
}

$done({ body: JSON.stringify(obj) });
