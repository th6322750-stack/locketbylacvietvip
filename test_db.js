const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_mc3MOlSFyeL6@ep-noisy-night-b3pozegr-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const res = await pool.query('SELECT uid, username FROM users ORDER BY username ASC');
  console.log('Total users:', res.rows.length);
  res.rows.forEach(u => console.log(`@${u.username} => ${u.uid}`));
  await pool.end();
})();
