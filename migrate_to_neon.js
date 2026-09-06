const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const NEON_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_mc3MOlSFyeL6@ep-noisy-night-b3pozegr-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false }
});

async function initAndMigrate() {
  const client = await pool.connect();
  try {
    console.log('⚡ Đang kết nối Neon PostgreSQL để khởi tạo Schema...');

    // 1. Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR(64) PRIMARY KEY,
        username VARCHAR(128),
        customer_uid VARCHAR(64),
        master_uid VARCHAR(64) DEFAULT 'C2A5eSIG79UquwvohWpirajDTVx2',
        has_gold BOOLEAN DEFAULT true,
        video_15s BOOLEAN DEFAULT false,
        video_15s_unlocked BOOLEAN DEFAULT false,
        expires_date TEXT,
        upgraded_at TEXT,
        price NUMERIC DEFAULT 60000,
        payment_status VARCHAR(32) DEFAULT 'paid',
        channel VARCHAR(64) DEFAULT 'zalo',
        avatar TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sepay_transactions (
        id VARCHAR(128) PRIMARY KEY,
        gateway VARCHAR(64),
        transfer_amount NUMERIC,
        content TEXT,
        username VARCHAR(128),
        uid VARCHAR(64),
        timestamp BIGINT,
        date TEXT,
        status VARCHAR(32) DEFAULT 'SUCCESS',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS anomalies (
        id VARCHAR(128) PRIMARY KEY,
        timestamp TEXT,
        username VARCHAR(128),
        uid VARCHAR(64),
        event_type VARCHAR(64),
        root_cause TEXT,
        revenuecat_snapshot JSONB,
        auto_heal_attempted BOOLEAN DEFAULT true,
        auto_heal_success BOOLEAN DEFAULT true,
        new_expires_date TEXT,
        status VARCHAR(32) DEFAULT 'RESOLVED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS masters (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128),
        fetch_token TEXT,
        expires_date TEXT,
        status VARCHAR(32) DEFAULT 'active',
        notes TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS coupons (
        code VARCHAR(64) PRIMARY KEY,
        type VARCHAR(32),
        value NUMERIC,
        description TEXT,
        active BOOLEAN DEFAULT true,
        usage_count INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(64) PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('✅ Đã tạo thành công Schema các bảng trên Neon Database!');

    // 2. Migrate users from users.json
    const usersFile = path.join(__dirname, 'data', 'users.json');
    if (fs.existsSync(usersFile)) {
      const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      let migratedCount = 0;
      for (const [uid, u] of Object.entries(usersData)) {
        if (!uid || uid.length < 10) continue;
        await client.query(`
          INSERT INTO users (uid, username, customer_uid, master_uid, has_gold, video_15s, video_15s_unlocked, expires_date, upgraded_at, price, payment_status, channel, avatar, notes, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          ON CONFLICT (uid) DO UPDATE SET
            username = EXCLUDED.username,
            has_gold = EXCLUDED.has_gold,
            expires_date = EXCLUDED.expires_date,
            upgraded_at = EXCLUDED.upgraded_at,
            price = EXCLUDED.price,
            payment_status = EXCLUDED.payment_status,
            channel = EXCLUDED.channel,
            avatar = EXCLUDED.avatar,
            notes = EXCLUDED.notes,
            updated_at = NOW();
        `, [
          uid,
          u.username || 'customer_' + uid.slice(0, 6),
          u.customer_uid || uid,
          u.master_uid || 'C2A5eSIG79UquwvohWpirajDTVx2',
          u.has_gold !== false,
          false,
          false,
          u.expires_date || '2026-10-03T11:26:26Z',
          u.upgraded_at || new Date().toISOString(),
          Number(u.price) || 60000,
          u.payment_status || 'paid',
          u.channel || 'zalo',
          u.avatar || '',
          u.notes || ''
        ]);
        migratedCount++;
      }
      console.log(`✅ Đã đồng bộ thành công ${migratedCount} tài khoản khách lên Neon Database!`);
    }

    // 3. Migrate Coupons
    const couponsFile = path.join(__dirname, 'data', 'coupons.json');
    if (fs.existsSync(couponsFile)) {
      const coupons = JSON.parse(fs.readFileSync(couponsFile, 'utf8'));
      for (const c of coupons) {
        await client.query(`
          INSERT INTO coupons (code, type, value, description, active, usage_count)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (code) DO UPDATE SET
            type = EXCLUDED.type,
            value = EXCLUDED.value,
            description = EXCLUDED.description,
            active = EXCLUDED.active;
        `, [c.code, c.type, c.value, c.description, c.active !== false, c.usage_count || 0]);
      }
      console.log('✅ Đã đồng bộ danh sách mã giảm giá lên Neon Database!');
    }

    // 4. Migrate Master Keys
    const mastersFile = path.join(__dirname, 'data', 'masters.json');
    if (fs.existsSync(mastersFile)) {
      const masterData = JSON.parse(fs.readFileSync(mastersFile, 'utf8'));
      const keys = masterData.keys || (masterData.active_token ? [{
        id: masterData.active_id || 'MASTER_01',
        name: 'Master Node 01',
        fetch_token: masterData.active_token,
        expires_date: masterData.expires_date || '2026-10-03T11:26:26Z',
        status: 'active',
        created_at: new Date().toISOString()
      }] : []);

      for (const k of keys) {
        await client.query(`
          INSERT INTO masters (id, name, fetch_token, expires_date, status, notes, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            fetch_token = EXCLUDED.fetch_token,
            expires_date = EXCLUDED.expires_date,
            status = EXCLUDED.status;
        `, [k.id, k.name, k.fetch_token, k.expires_date, k.status || 'active', k.notes || '', k.created_at || new Date().toISOString()]);
      }
      console.log('✅ Đã đồng bộ Master Keys lên Neon Database!');
    }

    // Check count
    const res = await client.query('SELECT COUNT(*) FROM users');
    console.log(`🎉 TỔNG SỐ TÀI KHOẢN TRÊN NEON CLOUD DATABASE: ${res.rows[0].count}`);

  } catch (err) {
    console.error('❌ Lỗi khởi tạo Neon Database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

initAndMigrate();
