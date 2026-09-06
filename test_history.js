const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_mc3MOlSFyeL6@ep-noisy-night-b3pozegr-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const r = await pool.query("SELECT timestamp, event_type, root_cause FROM anomalies WHERE username = 'thtrungg210' ORDER BY timestamp ASC");
  console.log('Total drops for thtrungg210:', r.rows.length);
  r.rows.forEach(row => console.log(row.timestamp, row.event_type));
  await pool.end();
})();
