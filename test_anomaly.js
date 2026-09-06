const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_mc3MOlSFyeL6@ep-noisy-night-b3pozegr-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const r = await pool.query("SELECT timestamp, username, uid, event_type, root_cause, revenuecat_snapshot FROM anomalies WHERE username = 'thtrungg210' ORDER BY timestamp DESC LIMIT 3");
  r.rows.forEach(row => {
    console.log('--- Timestamp:', row.timestamp, 'Event:', row.event_type, 'Cause:', row.root_cause);
    console.log('Snapshot entitlements:', JSON.stringify(row.revenuecat_snapshot?.entitlements));
    console.log('Snapshot subscriptions:', JSON.stringify(row.revenuecat_snapshot?.subscriptions));
  });
  await pool.end();
})();
