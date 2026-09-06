const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_mc3MOlSFyeL6@ep-noisy-night-b3pozegr-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    await pool.query(`
      INSERT INTO masters (id, name, fetch_token, expires_date, status, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        fetch_token = EXCLUDED.fetch_token,
        expires_date = EXCLUDED.expires_date,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes;
    `, [
      'MASTER_02',
      'Master Node 02 (Cụm 2 - StoreKit 2)',
      '510002836840566',
      '2026-10-03T11:26:26Z',
      'active',
      'Cụm Master 02 mở rộng tải (lacviet_master_node_02_2026)',
      new Date().toISOString()
    ]);
    console.log('✅ Đã lưu Master 02 vào Neon PostgreSQL!');
  } catch (e) {
    console.error('Error saving Master 02 to Neon:', e.message);
  }

  // Also save to masters.json
  const mastersFiles = [
    path.join(__dirname, 'data', 'masters.json'),
    path.join(__dirname, '..', 'locket-master-hub', 'data', 'masters.json')
  ];

  mastersFiles.forEach(f => {
    try {
      let list = [];
      if (fs.existsSync(f)) {
        try { list = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {}
      }
      if (!list.some(m => m.id === 'MASTER_02')) {
        list.push({
          id: 'MASTER_02',
          name: 'Master Node 02 (Cụm 2 - StoreKit 2)',
          uid: 'lacviet_master_node_02_2026',
          fetch_token: '510002836840566',
          expires_date: '2026-10-03T11:26:26Z',
          status: 'active',
          notes: 'Cụm Master 02 mở rộng tải cho khách 24+'
        });
        fs.writeFileSync(f, JSON.stringify(list, null, 2), 'utf8');
      }
    } catch (e) {}
  });

  const res = await pool.query('SELECT * FROM masters');
  console.log('Masters in DB:', res.rows);
  await pool.end();
})();
