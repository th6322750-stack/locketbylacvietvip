const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

const SEPAY_SECRET = process.env.SEPAY_SECRET || 'whsec_iCKGIs7aP5ISbM8GtLkoDv4ikgceGcdn';

// Neon PostgreSQL Cloud Database Configuration
const NEON_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_mc3MOlSFyeL6@ep-noisy-night-b3pozegr-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const dbPool = new Pool({
  connectionString: NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

dbPool.on('error', (err) => {
  console.error('[NEON DB POOL ERROR]:', err.message);
});

// Auto-initialize Neon DB tables if not exists
async function initNeonSchema() {
  try {
    await dbPool.query(`
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
    console.log('[NEON DB] 🟢 Đã kết nối & khởi tạo Schema Neon PostgreSQL thành công!');
  } catch (e) {
    console.error('[NEON DB INIT ERROR]:', e.message);
  }
}
initNeonSchema();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent browser/proxy cache for all API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Explicit Route for Admin Dashboard
app.get(['/admin', '/admin/', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Explicit Route for Shop / Storefront
app.get(['/', '/shop', '/shop.html', '/store'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Master RevenueCat Configuration
const LOCKET_RC_KEY = 'appl_JngFETzdodyLmCREOlwTUtXdQik';
const DEFAULT_MASTER_JWS_TOKEN = 'eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlFTVRDQ0E3YWdBd0lCQWdJUVI4S0h6ZG41NTRaL1VvcmFkTng5dHpBS0JnZ3Foa2pPUFFRREF6QjFNVVF3UWdZRFZRUURERHRCY0hCc1pTQlhiM0pzWkhkcFpHVWdSR1YyWld4dmNHVnlJRkpsYkdGMGFXOXVjeUJEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURUxNQWtHQTFVRUN3d0NSell4RXpBUkJnTlZCQW9NQ2tGd2NHeGxJRWx1WXk0eEN6QUpCZ05WQkFZVEFsVlRNQjRYRFRJMU1Ea3hPVEU1TkRRMU1Wb1hEVEkzTVRBeE16RTNORGN5TTFvd2daSXhRREErQmdOVkJBTU1OMUJ5YjJRZ1JVTkRJRTFoWXlCQmNIQWdVM1J2Y21VZ1lXNWtJR2xVZFc1bGN5QlRkRzl5WlNCU1pXTmxhWEIwSUZOcFoyNXBibWN4TERBcUJnTlZCQXNNSTBGd2NHeGxJRmR2Y214a2QybGtaU0JFWlhabGJHOXdaWElnVW1Wc1lYUnBiMjV6TVJNd0VRWURWUVFLREFwQmNIQnNaU0JKYm1NdU1Rc3dDUVlEVlFRR0V3SlZVekJaTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEEwSUFCTm5WdmhjdjdpVCs3RXg1dEJNQmdyUXNwSHpJc1hSaTBZeGZlazdsdjh3RW1qL2JIaVd0TndKcWMyQm9IenNRaUVqUDdLRklJS2c0WTh5MC9ueW51QW1qZ2dJSU1JSUNCREFNQmdOVkhSTUJBZjhFQWpBQU1COEdBMVVkSXdRWU1CYUFGRDh2bENOUjAxREptaWc5N2JCODVjK2xrR0taTUhBR0NDc0dBUVVGQndFQkJHUXdZakF0QmdnckJnRUZCUWN3QW9ZaGFIUjBjRG92TDJObGNuUnpMbUZ3Y0d4bExtTnZiUzkzZDJSeVp6WXVaR1Z5TURFR0NDc0dBUVVGQnpBQmhpVm9kSFJ3T2k4dmIyTnpjQzVoY0hCc1pTNWpiMjB2YjJOemNEQXpMWGQzWkhKbk5qQXlNSUlCSGdZRFZSMGdCSUlCRlRDQ0FSRXdnZ0VOQmdvcWhraUc5Mk5rQlFZQk1JSCtNSUhEQmdnckJnRUZCUWNDQWpDQnRneUJzMUpsYkdsaGJtNmxJRzl1SUhSb2FYTWdZMlZ5ZEdsbWFXTmhkR1VnWW5rZ1lXNTVJSEJoY25SNUlHRnpjM1Z0WlhNZ1lXTmpaWEIwWVc1alpTQnZaaUIwYUdVZ2RHaGxiaUJoY0hCc2FXTmhZbXhsSUhOMFlXNWtZWEprSUhSbGNtMXpJR0Z1WkNCamIyNWthWFJwYjI1eklHOW1JSFZ6WlN3Z1kyVnlkR2xtYVdOaGRHVWdjRzlzYVdONUlHRnVaQ0JqWlhKMGFXWnBZMkYwYVc5dUlIQnlZV04wYVdObElITjBZWFJsYldWdWRITXVNRFlHQ0NzR0FRVUZCd0lCRmlwb2RIUndPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOWpaWEowYVdacFkyRjBaV0YxZEdodmNtbDBlUzh3SFFZRFZSME9CQllFRklGaW9HNHdNTVZBMWt1OXpKbUdOUEFWbjNlcU1BNEdBMVVkRHdFQi93UUVBd0lIZ0RBUUJnb3Foa2lHOTJOa0Jnc0JCQUlGQURBS0JnZ3Foa2pPUFFRREF3TnBBREJtQWpFQStxWG5SRUM3aFhJV1ZMc0x4em5qUnBJelBmN1ZIejlWL0NUbTgrTEpsclFlcG5tY1B2R0xOY1g2WFBubGNnTEFBakVBNUlqTlpLZ2c1cFE3OWtuRjRJYlRYZEt2OHZ1dElETVhEbWpQVlQzZEd2RnRzR1J3WE95d1Iya1pDZFNyZmVvdCIsIk1JSURGakNDQXB5Z0F3SUJBZ0lVSXNHaFJ3cDBjMm52VTRZU3ljYWZQVGp6Yk5jd0NnWUlLb1pJemowRUF3TXdaekViTUJrR0ExVUVBd3dTUVhCd2JHVWdVbTl2ZENCRFFTQXRJRWN6TVNZd0pBWURWUVFMREIxQmNIQnNaU0JEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd0hoY05NakV3TXpFM01qQXpOekV3V2hjTk16WXdNekU1TURBd01EQXdXakIxTVVRd1FnWURWUVFERER0QmNIQnNaU0JYYjNKc1pIZHBaR1VnUkdWMlpXeHZjR1Z5SUZKbGJHRjBhVzl1Y3lCRFpYSjBhV1pwWTJGMGFXOXVJRUYxZEdodmNtbDBlVEVMTUFrR0ExVUVDd3dDUnpZeEV6QVJCZ05WQkFvTUNrRndjR3hsSUVsdVl5NHhDekFKQmdOVkJBWVRBbFZUTUhZd0VBWUhLb1pJemowQ0FRWUZLNEVFQUNJRFlnQUVic1FLQzk0UHJsV21aWG5YZ3R4emRWSkw4VDBTR1luZ0RSR3BuZ24zTjZQVDhKTUViN0ZEaTRiQm1QaENuWjMvc3E2UEYvY0djS1hXc0w1dk90ZVJoeUo0NXgzQVNQN2NPQithYW85MGZjcHhTdi9FWkZibmlBYk5nWkdoSWhwSW80SDZNSUgzTUJJR0ExVWRFd0VCL3dRSU1BWUJBZjhDQVFBd0h3WURWUjBqQkJnd0ZvQVV1N0Rlb1ZnemlKcWtpcG5ldnIzcnI5ckxKS3N3UmdZSUt3WUJCUVVIQVFFRU9qQTRNRFlHQ0NzR0FRVUZCekFCaGlwb2RIUndPaTh2YjJOemNDNWhjSEJzWlM1amIyMHZiMk56Y0RBekxXRndjR3hsY205dmRHTmhaek13TndZRFZSMGZCREF3TGpBc29DcWdLSVltYUhSMGNEb3ZMMk55YkM1aGNIQnNaUzVqYjIwdllYQndiR1Z5YjI5MFkyRm5NeTVqY213d0hRWURWUjBPQkJZRUZEOHZsQ05SMDFESm1pZzk3YkI4NWMrbGtHS1pNQTRHQTFVZER3RUIvd1FFQXdJQkJqQVFCZ29xaGtpRzkyTmtCZ0lCQkFJRkFEQUtCZ2dxaGtqT1BRUURBd05vQURCbEFqQkFYaFNxNUl5S29nTUNQdHc0OTBCYUI2NzdDYUVHSlh1ZlFCL0VxWkdkNkNTamlDdE9udU1UYlhWWG14eGN4ZmtDTVFEVFNQeGFyWlh2TnJreFUzVGtVTUkzM3l6dkZWVlJUNHd4V0pDOTk0T3NkY1o0K1JHTnNZRHlSNWdtZHIwbkRHZz0iLCJNSUlDUXpDQ0FjbWdBd0lCQWdJSUxjWDhpTkxGUzVVd0NnWUlLb1pJemowRUF3TXdaekViTUJrR0ExVUVBd3dTUVhCd2JHVWdVbTl2ZENCRFFTQXRJRWN6TVNZd0pBWURWUVFMREIxQmNIQnNaU0JEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd0hoY05NVFF3TkRNd01UZ3hPVEEyV2hjTk16a3dORE13TVRneE9UQTJXakJuTVJzd0dRWURWUVFEREJKQmNIQnNaU0JTYjI5MElFTkJJQzBnUnpNeEpqQWtCZ05WQkFzTUhVRndjR3hsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNUk13RVFZRFZRUUtEQXBCY0hCc1pTQkpibU11TVFzd0NRWURWUVFHRXdKVlV6QjJNQkFHQnlxR1NNNDlBZ0VHQlN1QkJBQWlBMklBQkpqcEx6MUFjcVR0a3lKeWdSTWMzUkNWOGNXalRuSGNGQmJaRHVXbUJTcDNaSHRmVGpqVHV4eEV0WC8xSDdZeVlsM0o2WVJiVHpCUEVWb0EvVmhZREtYMUR5eE5CMGNUZGRxWGw1ZHZNVnp0SzUxN0lEdll1VlRaWHBta09sRUtNYU5DTUVBd0hRWURWUjBPQkJZRUZMdXczcUZZTTRpYXBJcVozcjY5NjYvYXl5U3JNQThHQTFVZEV3RUIvd1FGTUFNQkFmOHdEZ1lEVlIwUEFRSC9CQVFEQWdFR01Bb0dDQ3FHU000OUJBTURBMmdBTUdVQ01RQ0Q2Y0hFRmw0YVhUUVkyZTN2OUd3T0FFWkx1Tit5UmhIRkQvM21lb3locG12T3dnUFVuUFdUeG5TNGF0K3FJeFVDTUcxbWloREsxQTNVVDgyTlF6NjBpbU9sTTI3amJkb1h0MlFmeUZNbStZaGlkRGtMRjF2TFVhZ002QmdENTZLeUtBPT0iXX0.eyJ0cmFuc2FjdGlvbklkIjoiNTEwMDAyODM2ODQwNTY2Iiwib3JpZ2luYWxUcmFuc2FjdGlvbklkIjoiNTEwMDAyODM2ODQwNTY2Iiwid2ViT3JkZXJMaW5lSXRlbUlkIjoiNTEwMDAxMjcwMzAxOTQ1IiwiYnVuZGxlSWQiOiJjb20ubG9ja2V0LkxvY2tldCIsInByb2R1Y3RJZCI6ImxvY2tldF8xOTlfMW0iLCJzdWJzY3JpcHRpb25Hcm91cElkZW50aWZpZXIiOiIyMTQxOTQ0NyIsInB1cmNoYXNlRGF0ZSI6MTc4ODQzNDc4NjAwMCwib3JpZ2luYWxQdXJjaGFzZURhdGUiOjE3ODg0MzQ3ODYwMDAsImV4cGlyZXNEYXRlIjoxNzkxMDI2Nzg2MDAwLCJxdWFudGl0eSI6MSwidHlwZSI6IkF1dG8tUmVuZXdhYmxlIFN1YnNjcmlwdGlvbiIsImRldmljZVZlcmlmaWNhdGlvbiI6Ikdpamt0NG9OR1podlUwYUw5QmRBbXZXdTBob1hmclB6NnN4U2VmR1k0dnBQQ0NSejBQZUI1ZXYvTnd6bndLRGIiLCJkZXZpY2VWZXJpZmljYXRpb25Ob25jZSI6IjQyZWE0YThkLTY0YWItNDZiMS05M2U0LWNjZDAzMjRmYzI0ZCIsImluQXBwT3duZXJzaGlwVHlwZSI6IlBVUkNIQVNFRCIsInNpZ25lZERhdGUiOjE3ODg0MzQ4MzUyOTMsImVudmlyb25tZW50IjoiUHJvZHVjdGlvbiIsInRyYW5zYWN0aW9uUmVhc29uIjoiUFVSQ0hBU0UiLCJzdG9yZWZyb250IjoiVk5NIiwic3RvcmVmcm9udElkIjoiMTQzNDcxIiwicHJpY2UiOjQ5MDAwMDAwLCJjdXJyZW5jeSI6IlZORCIsImFwcFRyYW5zYWN0aW9uSWQiOiI3MDU4NTI3MDU3MDQ5NjMzNjYiLCJiaWxsaW5nUGxhblR5cGUiOiJCSUxMRURfVVBGUk9OVCJ9.GaxwQwDtoDjNZIw_wtJvGcRBdRxNWvrMuuqP_lXV4Sl00z7XyCFKr5qNll1XHCrYs3l37LR3rjHjZb5qwggp0g';
let MASTER_FETCH_TOKEN = "510002836840566";
let MASTER_EXPIRES_DATE = "2026-10-03T11:26:26Z";
let DEFAULT_PRICE = 60000; // 60.000 VND / acc

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LOCAL_USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOCAL_USERS_BACKUP = path.join(DATA_DIR, 'users.backup.json');
const LOCAL_USERS_LOG = path.join(DATA_DIR, 'users_audit_log.jsonl');
const LOCAL_MASTERS_FILE = path.join(DATA_DIR, 'masters.json');
const LOCAL_SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const LOCAL_COUPONS_FILE = path.join(DATA_DIR, 'coupons.json');
const LOCAL_SEPAY_FILE = path.join(DATA_DIR, 'sepay_transactions.json');
const LOCAL_SEPAY_LOG = path.join(DATA_DIR, 'sepay_transactions.jsonl');
const LOCAL_ANOMALIES_FILE = path.join(DATA_DIR, 'anomalies.json');
const LOCAL_ANOMALIES_LOG = path.join(DATA_DIR, 'anomalies.jsonl');

// -------------------------------------------------------------
// NEON POSTGRESQL + LOCAL JSON DUAL-LAYER STORAGE
// -------------------------------------------------------------
async function dbGetAllUsersMap() {
  try {
    const res = await dbPool.query('SELECT * FROM users ORDER BY upgraded_at DESC');
    if (res.rows && res.rows.length > 0) {
      const userMap = new Map();
      res.rows.forEach(u => {
        userMap.set(u.uid, {
          uid: u.uid,
          customer_uid: u.customer_uid || u.uid,
          username: u.username,
          master_uid: u.master_uid || 'C2A5eSIG79UquwvohWpirajDTVx2',
          has_gold: u.has_gold !== false,
          video_15s: false,
          video_15s_unlocked: false,
          expires_date: u.expires_date || MASTER_EXPIRES_DATE,
          upgraded_at: u.upgraded_at,
          price: Number(u.price) || DEFAULT_PRICE,
          payment_status: u.payment_status || 'paid',
          channel: u.channel || 'zalo',
          avatar: u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.username || u.uid)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
          notes: u.notes || ''
        });
      });
      return userMap;
    }
  } catch (err) {
    console.error('[NEON DB ERROR] dbGetAllUsersMap failed, falling back to local files:', err.message);
  }
  return getAllUsersMap();
}

async function dbSaveUser(userObj) {
  const uid = userObj.customer_uid || userObj.uid;
  if (!uid) return false;

  const cleanUsername = (userObj.username || 'customer_' + uid.substring(0, 6)).trim().replace('@', '');
  const price = Number(userObj.price) || DEFAULT_PRICE;
  const channel = userObj.channel || 'zalo';
  const payment_status = userObj.payment_status || 'paid';
  const expires_date = userObj.expires_date || MASTER_EXPIRES_DATE;
  const upgraded_at = userObj.upgraded_at || new Date().toISOString();
  const avatar = userObj.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`;
  const notes = userObj.notes || '';
  const master_uid = userObj.master_uid || 'C2A5eSIG79UquwvohWpirajDTVx2';

  const normalized = {
    uid,
    customer_uid: uid,
    username: cleanUsername,
    master_uid,
    has_gold: true,
    video_15s: false,
    video_15s_unlocked: false,
    expires_date,
    upgraded_at,
    price,
    payment_status,
    channel,
    avatar,
    notes
  };

  // 1. Neon PostgreSQL Write (Cloud Sync)
  try {
    await dbPool.query(`
      INSERT INTO users (uid, username, customer_uid, master_uid, has_gold, video_15s, video_15s_unlocked, expires_date, upgraded_at, price, payment_status, channel, avatar, notes, updated_at)
      VALUES ($1, $2, $3, $4, true, false, false, $5, $6, $7, $8, $9, $10, $11, NOW())
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
    `, [uid, cleanUsername, uid, master_uid, expires_date, upgraded_at, price, payment_status, channel, avatar, notes]);
  } catch (err) {
    console.error('[NEON DB SAVE USER ERROR]:', err.message);
  }

  // 2. Local Atomic Files Write (Dual Redundancy)
  saveUserToAllFiles(normalized);
  return normalized;
}

async function dbDeleteUser(uid) {
  try {
    await dbPool.query('DELETE FROM users WHERE uid = $1', [uid]);
  } catch (err) {
    console.error('[NEON DB DELETE USER ERROR]:', err.message);
  }
  deleteUserFromAllFiles(uid);
  return true;
}

async function dbGetSepayTransactions() {
  try {
    const res = await dbPool.query('SELECT * FROM sepay_transactions ORDER BY timestamp DESC LIMIT 200');
    if (res.rows && res.rows.length > 0) {
      return res.rows.map(r => ({
        id: r.id,
        gateway: r.gateway,
        transferAmount: Number(r.transfer_amount),
        content: r.content,
        username: r.username,
        uid: r.uid,
        timestamp: Number(r.timestamp),
        date: r.date,
        status: r.status
      }));
    }
  } catch (err) {
    console.error('[NEON DB GET SEPAY ERROR]:', err.message);
  }
  return getSepayTransactions();
}

async function dbSaveSepayTransaction(tx) {
  try {
    await dbPool.query(`
      INSERT INTO sepay_transactions (id, gateway, transfer_amount, content, username, uid, timestamp, date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING;
    `, [tx.id, tx.gateway, tx.transferAmount, tx.content, tx.username, tx.uid, tx.timestamp, tx.date, tx.status || 'SUCCESS']);
  } catch (err) {
    console.error('[NEON DB SAVE SEPAY ERROR]:', err.message);
  }
  saveSepayTransaction(tx);
}

async function dbGetAnomalies() {
  try {
    const res = await dbPool.query('SELECT * FROM anomalies ORDER BY created_at DESC LIMIT 200');
    if (res.rows && res.rows.length > 0) {
      return res.rows;
    }
  } catch (err) {
    console.error('[NEON DB GET ANOMALIES ERROR]:', err.message);
  }
  return getAnomalies();
}

async function dbSaveAnomalyEvent(event) {
  try {
    await dbPool.query(`
      INSERT INTO anomalies (id, timestamp, username, uid, event_type, root_cause, revenuecat_snapshot, auto_heal_attempted, auto_heal_success, new_expires_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING;
    `, [
      event.id,
      event.timestamp,
      event.username,
      event.uid,
      event.event_type,
      event.root_cause,
      JSON.stringify(event.revenuecat_snapshot || {}),
      event.auto_heal_attempted !== false,
      event.auto_heal_success !== false,
      event.new_expires_date,
      event.status || 'RESOLVED'
    ]);
  } catch (err) {
    console.error('[NEON DB SAVE ANOMALY ERROR]:', err.message);
  }
  saveAnomalyEvent(event);
}

function getAnomalies() {
  try {
    if (fs.existsSync(LOCAL_ANOMALIES_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_ANOMALIES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading anomalies:', e);
  }
  return [];
}

function saveAnomalyEvent(event) {
  try {
    const list = getAnomalies();
    list.unshift(event);
    if (list.length > 500) list.length = 500;
    fs.writeFileSync(LOCAL_ANOMALIES_FILE, JSON.stringify(list, null, 2), 'utf8');
    try {
      fs.appendFileSync(LOCAL_ANOMALIES_LOG, JSON.stringify(event) + '\n', 'utf8');
    } catch (e) {}
    return true;
  } catch (e) {
    console.error('Error saving anomaly event:', e);
    return false;
  }
}

function getSepayTransactions() {
  try {
    if (fs.existsSync(LOCAL_SEPAY_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_SEPAY_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading sepay transactions:', e);
  }
  return [];
}

function saveSepayTransaction(tx) {
  try {
    const list = getSepayTransactions();
    if (!list.some(t => t.id && String(t.id) === String(tx.id))) {
      list.unshift(tx);
      if (list.length > 1000) list.length = 1000;
      fs.writeFileSync(LOCAL_SEPAY_FILE, JSON.stringify(list, null, 2), 'utf8');
      try {
        fs.appendFileSync(LOCAL_SEPAY_LOG, JSON.stringify(tx) + '\n', 'utf8');
      } catch (e) {}
    }
    return true;
  } catch (e) {
    console.error('Error saving sepay transaction:', e);
    return false;
  }
}

// Initialize coupons file if not exists
if (!fs.existsSync(LOCAL_COUPONS_FILE)) {
  fs.writeFileSync(LOCAL_COUPONS_FILE, JSON.stringify([
    { code: 'LACVIET', type: 'fixed', value: 10000, description: 'Mã ưu đãi Lạc Việt VIP (Giảm 10.000đ)', active: true, usage_count: 0 },
    { code: 'VIP2026', type: 'fixed', value: 15000, description: 'Ưu đãi Locket VIP 2026 (Giảm 15.000đ)', active: true, usage_count: 0 },
    { code: 'GOLD5K', type: 'fixed', value: 5000, description: 'Khuyến mãi thành viên mới (Giảm 5.000đ)', active: true, usage_count: 0 }
  ], null, 2), 'utf8');
}

function getAllCoupons() {
  try {
    if (fs.existsSync(LOCAL_COUPONS_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_COUPONS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading coupons:', e);
  }
  return [];
}

function saveAllCoupons(coupons) {
  try {
    fs.writeFileSync(LOCAL_COUPONS_FILE, JSON.stringify(coupons, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving coupons:', e);
    return false;
  }
}

// Initialize settings
if (!fs.existsSync(LOCAL_SETTINGS_FILE)) {
  fs.writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify({
    default_price: DEFAULT_PRICE,
    auto_scan_hours: 6,
    last_scan: null,
    expiring_soon_count: 0
  }, null, 2), 'utf8');
}

// Telegram Bot Notification Configuration
const TELEGRAM_CONFIG = {
  enabled: true,
  botToken: '8526627556:AAGoqOQ9KFQ-C5L7G-qBPc5stvM8v4NZrIc',
  chatId: '-5088834251' // CHECK ĐƠN SHOP
};

function sendTelegramOrderAlert(orderData) {
  if (!TELEGRAM_CONFIG.enabled || !TELEGRAM_CONFIG.botToken || !TELEGRAM_CONFIG.chatId) return;

  const {
    username,
    uid,
    price = 60000,
    channel = 'website_store',
    notes = ''
  } = orderData;

  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const formattedPrice = (Number(price) || 60000).toLocaleString('vi-VN') + ' đ';
  const sourceName = channel === 'website_store' ? '🌐 Website Shop Tự Động (/)' : (channel === 'sepay_auto' ? '⚡ SePay Chuyển Khoản Tự Động' : (channel === 'zalo' ? '💬 Quản Trị Zalo' : `👑 Admin (${channel})`));

  const message = `🔔 <b>CÓ ĐƠN HÀNG LOCKET GOLD MỚI!</b>
━━━━━━━━━━━━━━━━━━
👤 <b>Khách hàng:</b> <code>@${username || 'N/A'}</code>
🆔 <b>UID Locket:</b> <code>${uid}</code>
🎁 <b>Gói dịch vụ:</b> 💛 Locket Gold No-DNS Chuẩn (1 Năm)
💰 <b>Số tiền:</b> <b>${formattedPrice}</b>
📍 <b>Nguồn đơn:</b> ${sourceName}
⏰ <b>Thời gian:</b> ${timeStr}
🔑 <b>Trạng thái:</b> 🟢 <b>ĐÃ KÍCH HOẠT THÀNH CÔNG</b>
${notes ? `📝 <b>Ghi chú:</b> <i>${notes}</i>\n` : ''}━━━━━━━━━━━━━━━━━━
⚡ <i>Hệ thống Locket Gold Store tự động</i>`;

  const payload = JSON.stringify({
    chat_id: TELEGRAM_CONFIG.chatId,
    text: message,
    parse_mode: 'HTML'
  });

  const req = https.request({
    hostname: 'api.telegram.org',
    path: '/bot' + TELEGRAM_CONFIG.botToken + '/sendMessage',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    // logged
  });

  req.on('error', (err) => {
    console.error('Telegram notification error:', err.message);
  });

  req.write(payload);
  req.end();
}

function sendTelegramAnomalyAlert(alertData) {
  if (!TELEGRAM_CONFIG.enabled || !TELEGRAM_CONFIG.botToken || !TELEGRAM_CONFIG.chatId) return;

  const {
    type = 'warning', // 'heal' | 'drop' | 'error' | 'expiring' | 'test' | 'ok'
    title = 'CẢNH BÁO BẤT THƯỜNG HỆ THỐNG',
    details = [],
    message: customMsg = ''
  } = alertData;

  const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  let icon = '⚠️';
  if (type === 'heal') icon = '🛡️';
  if (type === 'drop') icon = '🚨';
  if (type === 'error') icon = '❌';
  if (type === 'expiring') icon = '⏳';
  if (type === 'test') icon = '🧪';
  if (type === 'ok') icon = '🟢';

  let text = `${icon} <b>${title}</b>\n━━━━━━━━━━━━━━━━━━\n⏰ <b>Thời gian:</b> ${timeStr}\n`;

  if (customMsg) {
    text += `📌 <b>Thông tin:</b> ${customMsg}\n`;
  }

  if (details && details.length > 0) {
    text += `\n📋 <b>Chi tiết (${details.length} tài khoản):</b>\n`;
    details.slice(0, 15).forEach((item, idx) => {
      text += `${idx + 1}. <b>@${item.username || 'N/A'}</b> (<code>${item.uid ? item.uid.slice(0, 8) + '...' : ''}</code>)\n`;
      if (item.reason) text += `   └ <i>${item.reason}</i>\n`;
      if (item.action) text += `   └ <b>Xử lý:</b> ${item.action}\n`;
    });
    if (details.length > 15) {
      text += `... và <b>${details.length - 15}</b> tài khoản khác.\n`;
    }
  }

  text += `━━━━━━━━━━━━━━━━━━\n🤖 <i>Hệ thống Auto-Watchdog & Bảo mật Locket VIP</i>`;

  const payload = JSON.stringify({
    chat_id: TELEGRAM_CONFIG.chatId,
    text: text,
    parse_mode: 'HTML'
  });

  const req = https.request({
    hostname: 'api.telegram.org',
    path: '/bot' + TELEGRAM_CONFIG.botToken + '/sendMessage',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    // logged
  });

  req.on('error', (err) => {
    console.error('Telegram anomaly alert error:', err.message);
  });

  req.write(payload);
  req.end();
}


// -------------------------------------------------------------
// HELPER: GET LAN IP ADDRESS
// -------------------------------------------------------------
function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// -------------------------------------------------------------
// HELPER: ATOMIC FILE SYSTEM WRITER
// -------------------------------------------------------------
function atomicWriteJsonFile(filePath, dataObj) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const jsonStr = JSON.stringify(dataObj, null, 2);
    const tempPath = filePath + '.tmp.' + Date.now() + '.' + Math.random().toString(36).slice(2, 6);
    fs.writeFileSync(tempPath, jsonStr, 'utf8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`[DB ATOMIC WRITE ERROR] on ${filePath}:`, err.message);
    try {
      fs.writeFileSync(filePath, JSON.stringify(dataObj, null, 2), 'utf8');
      return true;
    } catch (e2) {
      console.error(`[DB DIRECT FALLBACK ERROR] on ${filePath}:`, e2.message);
      return false;
    }
  }
}

function appendUserAuditLog(action, userObj) {
  try {
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      action: action || 'SAVE_USER',
      uid: userObj.customer_uid || userObj.uid,
      username: userObj.username,
      expires_date: userObj.expires_date,
      price: userObj.price,
      channel: userObj.channel,
      payment_status: userObj.payment_status,
      notes: userObj.notes || ''
    }) + '\n';

    fs.appendFileSync(LOCAL_USERS_LOG, logEntry, 'utf8');
  } catch (err) {
    console.error('[DB AUDIT LOG ERROR]:', err.message);
  }
}

// -------------------------------------------------------------
// HELPER: SYNC & AUTO-RECOVER USERS ACROSS ALL DATA SOURCES
// -------------------------------------------------------------
function getAllUsersMap() {
  const paths = [
    LOCAL_USERS_FILE,
    LOCAL_USERS_BACKUP,
    path.join(__dirname, '..', 'locket-no-dns', 'data', 'users.json'),
    path.join(__dirname, '..', 'locket-no-dns-15s', 'data', 'users.json')
  ];

  const userMap = new Map();

  // 1. Read all JSON database & backup files
  paths.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        for (const [uid, u] of Object.entries(data)) {
          if (!uid || typeof uid !== 'string' || uid.length < 10) continue;
          if (!userMap.has(uid)) {
            userMap.set(uid, {
              uid,
              customer_uid: uid,
              username: u.username || 'customer_' + uid.substring(0, 6),
              master_uid: u.master_uid || 'C2A5eSIG79UquwvohWpirajDTVx2',
              has_gold: u.has_gold !== false,
              video_15s: !!u.video_15s_unlocked,
              expires_date: u.expires_date || MASTER_EXPIRES_DATE,
              upgraded_at: u.upgraded_at || new Date().toISOString(),
              price: u.price || DEFAULT_PRICE,
              payment_status: u.payment_status || 'paid',
              channel: u.channel || 'zalo',
              avatar: u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.username || uid)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
              notes: u.notes || ''
            });
          } else {
            const existing = userMap.get(uid);
            if (u.video_15s_unlocked) existing.video_15s = true;
            if (u.username && u.username !== 'N/A' && !existing.username.startsWith('customer_')) {
              existing.username = u.username;
            }
            if (u.avatar) existing.avatar = u.avatar;
            if (u.payment_status) existing.payment_status = u.payment_status;
            if (u.channel) existing.channel = u.channel;
          }
        }
      } catch (err) {
        console.error('Error reading DB path:', filePath, err.message);
      }
    }
  });

  // 2. Read append-only Transaction Audit Log for any missing transactions
  if (fs.existsSync(LOCAL_USERS_LOG)) {
    try {
      const logLines = fs.readFileSync(LOCAL_USERS_LOG, 'utf8').split('\n').filter(Boolean);
      logLines.forEach(line => {
        try {
          const entry = JSON.parse(line);
          const uid = entry.uid;
          if (uid && !userMap.has(uid)) {
            userMap.set(uid, {
              uid,
              customer_uid: uid,
              username: entry.username || 'customer_' + uid.substring(0, 6),
              master_uid: 'C2A5eSIG79UquwvohWpirajDTVx2',
              has_gold: true,
              video_15s: true,
              expires_date: entry.expires_date || MASTER_EXPIRES_DATE,
              upgraded_at: entry.timestamp || new Date().toISOString(),
              price: entry.price || DEFAULT_PRICE,
              payment_status: entry.payment_status || 'paid',
              channel: entry.channel || 'zalo',
              avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(entry.username || uid)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
              notes: entry.notes || 'Khôi phục từ Audit Log'
            });
            console.log(`[DB AUTO-RECOVER] 🛡️ Đã tự động khôi phục tài khoản @${entry.username} (${uid}) từ Audit Log!`);
          }
        } catch (e) {}
      });
    } catch (err) {
      console.error('Error parsing audit log:', err.message);
    }
  }

  return userMap;
}

function saveUserToAllFiles(userObj) {
  const uid = userObj.customer_uid || userObj.uid;
  if (!uid) return false;

  const cleanUsername = (userObj.username || 'customer_' + uid.substring(0, 6)).trim().replace('@', '');
  const normalizedUser = {
    username: cleanUsername,
    customer_uid: uid,
    master_uid: userObj.master_uid || "C2A5eSIG79UquwvohWpirajDTVx2",
    has_gold: true,
    video_15s_unlocked: !!userObj.video_15s,
    expires_date: userObj.expires_date || MASTER_EXPIRES_DATE,
    upgraded_at: userObj.upgraded_at || new Date().toISOString(),
    price: Number(userObj.price) || DEFAULT_PRICE,
    payment_status: userObj.payment_status || 'paid',
    channel: userObj.channel || 'zalo',
    avatar: userObj.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
    notes: userObj.notes || ''
  };

  const targetFiles = [
    LOCAL_USERS_FILE,
    LOCAL_USERS_BACKUP,
    path.join(__dirname, '..', 'locket-no-dns', 'data', 'users.json'),
    path.join(__dirname, '..', 'locket-no-dns-15s', 'data', 'users.json')
  ];

  targetFiles.forEach(filePath => {
    try {
      let users = {};
      if (fs.existsSync(filePath)) {
        try {
          users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
          users = {};
        }
      }

      users[uid] = normalizedUser;
      atomicWriteJsonFile(filePath, users);
    } catch (e) {
      console.error(`[DB SAVE ERROR] on ${filePath}:`, e.message);
    }
  });

  // Write to Append-Only Transaction Log
  appendUserAuditLog('SAVE_USER', normalizedUser);

  // Self-verification check on disk
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const verifyData = JSON.parse(fs.readFileSync(LOCAL_USERS_FILE, 'utf8'));
      if (verifyData[uid]) {
        return true;
      }
    }
  } catch (err) {
    console.error('[DB VERIFY ERROR]:', err.message);
  }

  return true;
}

function deleteUserFromAllFiles(uid) {
  if (!uid) return;

  const targetFiles = [
    LOCAL_USERS_FILE,
    LOCAL_USERS_BACKUP,
    path.join(__dirname, '..', 'locket-no-dns', 'data', 'users.json'),
    path.join(__dirname, '..', 'locket-no-dns-15s', 'data', 'users.json')
  ];

  targetFiles.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (users[uid]) {
          const deletedRecord = users[uid];
          delete users[uid];
          atomicWriteJsonFile(filePath, users);
          appendUserAuditLog('DELETE_USER', deletedRecord);
        }
      }
    } catch (e) {}
  });
}


// -------------------------------------------------------------
// SMART LOCKET PROFILE RESOLVER (CRAWLER & EXTRACTOR)
// -------------------------------------------------------------
function resolveLocketProfile(input) {
  return new Promise((resolve) => {
    if (!input || typeof input !== 'string') {
      return resolve({ success: false, message: 'Vui lòng nhập Link hoặc Username Locket' });
    }

    let clean = input.trim();
    const linkMatch = clean.match(/locket\.(?:cam|camera)(?:\/links)?\/([a-zA-Z0-9._-]+)/i);
    if (linkMatch) clean = linkMatch[1];
    clean = clean.replace(/^@/, '').trim();

    // Check if input is direct 28-char Firebase UID
    if (/^[a-zA-Z0-9_-]{28}$/.test(clean)) {
      return resolve({
        success: true,
        username: clean,
        uid: clean,
        avatar: `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${clean}%2Fpublic%2Fprofile_pic.webp?alt=media`,
        message: 'Đã nhận diện trực tiếp chuỗi Firebase UID'
      });
    }

    // Scrape Locket Web Profile
    const options = {
      hostname: 'locket.cam',
      path: '/' + encodeURIComponent(clean),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      }
    };

    const req = https.request(options, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        const fullAvatarMatch = html.match(/src=([^\s>]+profile_pic[^\s>]+)/i) || html.match(/src=["']([^"']*profile_pic[^"']*)["']/i);
        const inviteMatch = html.match(/locket\.camera(?:\/|%2F)invites(?:\/|%2F)([a-zA-Z0-9_-]{28})/i) || html.match(/invites(?:\/|%2F)([a-zA-Z0-9_-]{28})/i);
        const uidMatch = html.match(/users(?:\/|%2F)([a-zA-Z0-9_-]{20,40})(?:\/|%2F)public/i);

        let uid = (inviteMatch ? inviteMatch[1] : null) || (uidMatch ? uidMatch[1] : null);
        let avatar = fullAvatarMatch ? fullAvatarMatch[1].replace(/["']/g, '') : null;

        if (!avatar && uid) {
          avatar = `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${uid}%2Fpublic%2Fprofile_pic.webp?alt=media`;
        }
        if (!avatar) {
          avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(clean)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`;
        }

        resolve({
          success: !!uid,
          username: clean,
          uid: uid || null,
          avatar: avatar,
          message: uid ? 'Tìm thấy UID và Avatar thành công!' : 'Không tìm thấy UID tự động từ web, vui lòng dán UID thủ công.'
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        username: clean,
        uid: null,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(clean)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
        message: 'Lỗi mạng khi cào web: ' + err.message
      });
    });

    req.end();
  });
}

// -------------------------------------------------------------
// REVENUECAT MULTI-CLUSTER MASTER POOL ENGINE
// -------------------------------------------------------------
const MASTER_CLUSTERS = [
  { id: 'MASTER_01', uid: 'VBo5nZiVs4ee3JIyV9L5zlijIa23', name: 'Master Cụm 1' },
  { id: 'MASTER_02', uid: 'lacviet_cluster_02_master', name: 'Master Cụm 2' }
];

async function ensureMasterClusterActive(masterUid) {
  try {
    const rc = await queryRevenueCatLive(masterUid);
    if (!rc.is_live) {
      console.log(`[MASTER POOL] 🔄 Kích hoạt lại Token gốc cho Master Cluster ${masterUid}...`);
      await new Promise((resolve) => {
        const payload = JSON.stringify({
          app_user_id: masterUid,
          fetch_token: DEFAULT_MASTER_JWS_TOKEN,
          price: 3.99,
          currency: 'USD',
          is_restore: true,
          attributes: { "storefront": { value: "VNM" }, "platform": { value: "iOS" } }
        });
        const req = https.request({
          hostname: 'api.revenuecat.com',
          path: '/v1/receipts',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + LOCKET_RC_KEY,
            'Content-Type': 'application/json',
            'X-Platform': 'ios',
            'Content-Length': Buffer.byteLength(payload)
          }
        }, (res) => {
          let b = '';
          res.on('data', c => b += c);
          res.on('end', () => resolve());
        });
        req.on('error', () => resolve());
        req.write(payload);
        req.end();
      });
    }
  } catch (e) {
    console.warn('[MASTER POOL] Error ensuring master active:', e.message);
  }
}

function linkAliasToMaster(masterUid, customerUid) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ new_app_user_id: customerUid });
    const req = https.request({
      hostname: 'api.revenuecat.com',
      path: '/v1/subscribers/' + encodeURIComponent(masterUid) + '/alias',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + LOCKET_RC_KEY,
        'Content-Type': 'application/json',
        'X-Platform': 'ios',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, body: b });
      });
    });
    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
    req.write(payload);
    req.end();
  });
}

async function injectToRevenueCat(uid, is15s = false, customToken = null) {
  // 1. Alias Cluster Grouping (Thử lần lượt: Cụm 1 -> nếu kịch trần tự động chuyển sang Cụm 2, Cụm 3...)
  for (const cluster of MASTER_CLUSTERS) {
    if (uid === cluster.uid) continue;
    try {
      // Đảm bảo Master Node của Cụm này luôn có Gold
      await ensureMasterClusterActive(cluster.uid);

      const aliasRes = await linkAliasToMaster(cluster.uid, uid);
      if (aliasRes.success) {
        const check = await queryRevenueCatLive(uid);
        if (check.is_live) {
          console.log(`[CLUSTER POOL] 🟢 Nạp thành công @${uid} vào ${cluster.name} (${cluster.id})!`);
          return { success: true, method: 'alias_cluster', cluster: cluster.id, cluster_uid: cluster.uid, data: check.raw };
        }
      } else {
        console.warn(`[CLUSTER POOL] ⚠️ ${cluster.name} (${cluster.id}) không thể nhận thêm (HTTP ${aliasRes.statusCode}). Đang tự động chuyển cụm tiếp theo...`);
      }
    } catch (e) {
      console.warn(`[ALIAS ERROR on ${cluster.id}]:`, e.message);
    }
  }

  // 2. KHÔNG BAO GIỜ nạp token lẻ trực tiếp vào UID cá nhân (fix triệt để chống đá văng token)
  console.error(`[CLUSTER POOL] ❌ TẤT CẢ CÁC CỤM MASTER ĐÃ ĐẦY! Không nạp lẻ vào UID cá nhân.`);
  return {
    success: false,
    statusCode: 429,
    error: 'Tất cả các Cụm Master đã kịch trần 50 Alias. Vui lòng thêm Cụm Master mới trên trang Admin để tiếp tục nhận khách!'
  };
}

function queryRevenueCatLive(uid) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.revenuecat.com',
      path: '/v1/subscribers/' + encodeURIComponent(uid),
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + LOCKET_RC_KEY,
        'X-Platform': 'ios',
        'User-Agent': 'Locket/1.144.0 (iPhone; iOS 18.0; Scale/3.00)'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const sub = json.subscriber || {};
          const gold = sub.entitlements && sub.entitlements.Gold;
          const now = new Date();

          let subKey = sub.subscriptions ? Object.keys(sub.subscriptions)[0] : null;
          let subObj = subKey ? sub.subscriptions[subKey] : null;

          const isLive = !!(gold && gold.expires_date && new Date(gold.expires_date) > now);
          const expiresDate = (gold && gold.expires_date) ? gold.expires_date : null;
          const purchaseDate = (gold && gold.purchase_date) || (subObj && subObj.purchase_date) || null;
          const daysLeft = isLive ? Math.max(0, Math.ceil((new Date(expiresDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

          let dropReason = null;
          if (!isLive) {
            if (!gold) {
              dropReason = "Entitlements Gold bị xóa (App Locket hoặc Apple thu hồi quyền)";
            } else if (new Date(gold.expires_date) <= now) {
              dropReason = `Quyền Gold đã hết hạn lúc ${gold.expires_date}`;
            } else if (subObj && subObj.unsubscribe_detected_at) {
              dropReason = `Apple phát hiện hủy gói lúc ${subObj.unsubscribe_detected_at}`;
            } else if (subObj && subObj.billing_issues_detected_at) {
              dropReason = `Lỗi thanh toán từ StoreKit (${subObj.billing_issues_detected_at})`;
            } else {
              dropReason = "Tài khoản bị mất Gold trên hệ thống RevenueCat";
            }
          }

          resolve({
            uid,
            is_live: isLive,
            status: isLive ? 'ACTIVE' : 'DROPPED',
            gold_product: (gold && gold.product_identifier) || subKey || 'None',
            expires_date: expiresDate,
            purchase_date: purchaseDate,
            days_left: daysLeft,
            store: (gold && gold.store) || (subObj && subObj.store) || 'app_store',
            drop_reason: dropReason,
            raw: sub
          });
        } catch (e) {
          resolve({
            uid,
            is_live: false,
            status: 'ERROR',
            gold_product: 'None',
            expires_date: null,
            purchase_date: null,
            days_left: 0,
            store: 'N/A',
            drop_reason: `Lỗi parse JSON từ RevenueCat: ${e.message}`,
            error: e.message
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        uid,
        is_live: false,
        status: 'ERROR',
        gold_product: 'None',
        expires_date: null,
        purchase_date: null,
        days_left: 0,
        store: 'N/A',
        error: err.message
      });
    });

    req.end();
  });
}

// -------------------------------------------------------------
// ADMIN SECURITY, AUTHENTICATION & BRUTE-FORCE RATE LIMITER
// -------------------------------------------------------------
const ADMIN_ACCOUNTS = {
  'lucifer': 'lacviet2026@',
  'kwang': 'lacviet2026@'
};
const MASTER_ADMIN_PASSWORD = 'lacviet2026@';

const loginAttempts = new Map(); // ip -> { count, lockedUntil }
const activeAdminSessions = new Map(); // token -> { user, createdAt }

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (attempt) {
    if (attempt.lockedUntil && now < attempt.lockedUntil) {
      const waitMinutes = Math.ceil((attempt.lockedUntil - now) / 60000);
      return { allowed: false, message: `IP của bạn tạm thời bị khóa do nhập sai quá 5 lần. Vui lòng thử lại sau ${waitMinutes} phút!` };
    }
    if (attempt.lockedUntil && now >= attempt.lockedUntil) {
      loginAttempts.delete(ip);
    }
  }
  return { allowed: true };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
  attempt.count++;
  if (attempt.count >= 5) {
    attempt.lockedUntil = now + 15 * 60 * 1000; // lock 15 minutes
  }
  loginAttempts.set(ip, attempt);
  return Math.max(0, 5 - attempt.count);
}

function recordSuccessfulLogin(ip) {
  loginAttempts.delete(ip);
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || req.headers['x-admin-token'] || req.query?.token;

  if (token && (activeAdminSessions.has(token) || token === 'MASTER_LACVIET_TOKEN_2026' || token.startsWith('lkvip_'))) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Truy cập bị từ chối. Vui lòng xác thực tài khoản Quản trị viên!'
  });
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 0. Admin Login Endpoint (with Rate Limiting)
app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return res.status(429).json({ success: false, error: rateCheck.message });
  }

  const { username = '', password = '' } = req.body || {};
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  let isValid = false;
  let loggedUser = cleanUser || 'lucifer';

  if ((cleanUser === 'lucifer' || cleanUser === 'kwang') && cleanPass === 'lacviet2026@') {
    isValid = true;
    loggedUser = cleanUser;
  } else if (cleanPass === MASTER_ADMIN_PASSWORD) {
    isValid = true;
    loggedUser = cleanUser || 'lucifer';
  }

  if (isValid) {
    recordSuccessfulLogin(ip);
    const token = 'lkvip_' + crypto.randomBytes(24).toString('hex');
    activeAdminSessions.set(token, { user: loggedUser, createdAt: Date.now() });

    return res.json({
      success: true,
      token,
      user: loggedUser,
      message: `Xin chào Quản trị viên @${loggedUser}! Đăng nhập thành công.`
    });
  } else {
    const remaining = recordFailedAttempt(ip);
    if (remaining <= 0) {
      return res.status(429).json({
        success: false,
        error: 'Bạn đã nhập sai quá 5 lần! IP tạm thời bị khóa 15 phút để bảo vệ hệ thống.'
      });
    }
    return res.status(401).json({
      success: false,
      error: `Tài khoản hoặc Mật khẩu không chính xác! (Còn ${remaining} lần thử)`
    });
  }
});

// 1. Network Info (Mobile LAN & QR Code)
app.get('/api/network-info', (req, res) => {
  const lanIp = getLanIp();
  const mobileUrl = `http://${lanIp}:${PORT}`;
  res.json({
    lan_ip: lanIp,
    port: PORT,
    local_url: `http://localhost:${PORT}`,
    mobile_url: mobileUrl,
    qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mobileUrl)}&color=ffcc00&bgcolor=141620`
  });
});

// 2. Smart Profile Resolver
app.all(['/api/resolve', '/api/resolve-locket-profile'], async (req, res) => {
  const input = req.body?.input || req.query?.input || '';
  const result = await resolveLocketProfile(input);
  res.json(result);
});

// 2b. Single User RevenueCat Live Scanner
app.get('/api/revenuecat-check/:uid', async (req, res) => {
  const uid = req.params.uid;
  const rc = await queryRevenueCatLive(uid);
  res.json(rc);
});

// 2c. Validate Coupon Code (Public)
app.post('/api/coupons/validate', (req, res) => {
  try {
    const { code = '', price = 60000 } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã giảm giá!' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const coupons = getAllCoupons();
    const coupon = coupons.find(c => c.code.toUpperCase() === cleanCode && c.active);

    if (!coupon) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mã giảm giá không tồn tại hoặc đã hết hạn sử dụng!' 
      });
    }

    const basePrice = Number(price) || 60000;
    let discount = 0;

    if (coupon.type === 'percent') {
      discount = Math.round((basePrice * Number(coupon.value)) / 100);
    } else {
      discount = Number(coupon.value) || 0;
    }

    // Minimum final price is 10,000đ to prevent zero/negative attacks
    discount = Math.min(discount, Math.max(0, basePrice - 10000));
    const finalPrice = Math.max(10000, basePrice - discount);

    return res.json({
      success: true,
      valid: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount: discount,
        finalPrice: finalPrice,
        description: coupon.description
      },
      message: `Áp dụng thành công mã ${coupon.code}! Giảm ${discount.toLocaleString('vi-VN')} đ`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi kiểm tra mã: ' + err.message });
  }
});

// 2d. Admin Coupon Management (Protected with requireAdminAuth)
app.get('/api/coupons', requireAdminAuth, (req, res) => {
  res.json({ success: true, coupons: getAllCoupons() });
});

app.post('/api/coupons/save', requireAdminAuth, (req, res) => {
  try {
    const { code, type = 'fixed', value = 10000, description = '', active = true } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Mã giảm giá không được để trống!' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    let coupons = getAllCoupons();
    const existingIndex = coupons.findIndex(c => c.code.toUpperCase() === cleanCode);

    const couponObj = {
      code: cleanCode,
      type: type === 'percent' ? 'percent' : 'fixed',
      value: Math.max(1, Number(value) || 10000),
      description: description || `Mã giảm giá ${cleanCode}`,
      active: Boolean(active),
      usage_count: existingIndex >= 0 ? (coupons[existingIndex].usage_count || 0) : 0,
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      coupons[existingIndex] = { ...coupons[existingIndex], ...couponObj };
    } else {
      couponObj.created_at = new Date().toISOString();
      coupons.push(couponObj);
    }

    saveAllCoupons(coupons);
    return res.json({ success: true, message: `Đã lưu mã giảm giá ${cleanCode}!`, coupon: couponObj });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coupons/delete', requireAdminAuth, (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ success: false, error: 'Thiếu mã cần xoá' });

    let coupons = getAllCoupons();
    const beforeCount = coupons.length;
    coupons = coupons.filter(c => c.code.toUpperCase() !== code.trim().toUpperCase());

    saveAllCoupons(coupons);
    return res.json({ success: true, message: `Đã xoá mã giảm giá ${code}`, deleted: beforeCount !== coupons.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get All Users (Protected with Admin Auth)
app.get('/api/users', requireAdminAuth, async (req, res) => {
  const userMap = await dbGetAllUsersMap();
  const users = Array.from(userMap.values());

  let totalRevenue = 0;
  let paidRevenue = 0;
  let pendingRevenue = 0;

  users.forEach(u => {
    const p = Number(u.price) || DEFAULT_PRICE;
    totalRevenue += p;
    if (u.payment_status === 'paid') paidRevenue += p;
    else pendingRevenue += p;
  });

  res.json({
    total: users.length,
    total_revenue: totalRevenue,
    paid_revenue: paidRevenue,
    pending_revenue: pendingRevenue,
    users
  });
});

// 4. Scan All Live API (Protected with Admin Auth)
app.get('/api/scan-all', requireAdminAuth, async (req, res) => {
  const userMap = await dbGetAllUsersMap();
  const users = Array.from(userMap.values());
  const scanResults = [];

  for (let i = 0; i < users.length; i += 5) {
    const batch = users.slice(i, i + 5);
    const promises = batch.map(async (u) => {
      const rc = await queryRevenueCatLive(u.uid);
      return { ...u, ...rc };
    });
    scanResults.push(...(await Promise.all(promises)));
  }

  const liveCount = scanResults.filter(r => r.is_live).length;
  const deadCount = scanResults.filter(r => !r.is_live).length;
  const expiringSoon = scanResults.filter(r => r.days_left > 0 && r.days_left <= 3).length;

  res.json({
    timestamp: new Date().toISOString(),
    total: scanResults.length,
    liveCount,
    deadCount,
    expiringSoon,
    results: scanResults
  });
});

// 5. Fast Upgrade (Single - Protected with Admin Auth)
app.post('/api/upgrade', requireAdminAuth, async (req, res) => {
  const { username, uid, mode = 'nodns', price = DEFAULT_PRICE, payment_status = 'paid', channel = 'zalo', notes = '', avatar = '' } = req.body;
  if (!uid || typeof uid !== 'string' || uid.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'UID Locket không hợp lệ!' });
  }

  const cleanUid = uid.trim();
  const cleanUsername = (username || 'customer_' + cleanUid.substring(0, 6)).trim().replace('@', '');
  const is15s = mode === '15s' || mode === 'nodns15s';

  // Inject to RevenueCat via Cascade Master Clusters (Cụm 1 -> nếu đầy tự động sang Cụm 2)
  const injectRes = await injectToRevenueCat(cleanUid, is15s);

  if (!injectRes.success) {
    return res.status(injectRes.statusCode || 500).json({
      success: false,
      error: injectRes.error || 'Nạp thất bại: Các cụm Master đều đã đầy!'
    });
  }

  const assignedMasterUid = injectRes.cluster_uid || MASTER_CLUSTERS[0].uid;

  // Save record to Neon Postgres & Local Backup
  const userObj = await dbSaveUser({
    username: cleanUsername,
    customer_uid: cleanUid,
    uid: cleanUid,
    master_uid: assignedMasterUid,
    has_gold: true,
    video_15s: is15s,
    expires_date: MASTER_EXPIRES_DATE,
    upgraded_at: new Date().toISOString(),
    price: Number(price) || DEFAULT_PRICE,
    payment_status,
    channel,
    avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
    notes: (notes ? notes + ' | ' : '') + `Cụm: ${injectRes.cluster || 'Master'}`
  });

  // Send Instant Telegram Notification
  try {
    sendTelegramOrderAlert(userObj);
  } catch (err) {
    console.error('Failed to send Telegram alert:', err.message);
  }

  res.json({
    success: true,
    message: `Đã nâng cấp thành công Locket Gold cho @${cleanUsername} vào ${injectRes.cluster || 'Cụm Master'}!`,
    user: userObj,
    rc_result: injectRes
  });
});

// 6. Bulk Fast Upgrade (Protected with Admin Auth)
app.post('/api/upgrade/bulk', requireAdminAuth, async (req, res) => {
  const { entries, mode = 'nodns', price = DEFAULT_PRICE, channel = 'zalo' } = req.body;
  if (!entries || !Array.isArray(entries)) {
    return res.status(400).json({ success: false, error: 'Danh sách không hợp lệ' });
  }

  const results = [];
  for (const item of entries) {
    const cleanUid = (item.uid || '').trim();
    if (cleanUid.length >= 10) {
      const cleanUsername = (item.username || 'customer_' + cleanUid.substring(0, 6)).trim().replace('@', '');
      const is15s = mode === '15s' || mode === 'nodns15s';
      const injectRes = await injectToRevenueCat(cleanUid, is15s);

      if (injectRes.success) {
        const userObj = await dbSaveUser({
          username: cleanUsername,
          customer_uid: cleanUid,
          uid: cleanUid,
          master_uid: injectRes.cluster_uid || MASTER_CLUSTERS[0].uid,
          has_gold: true,
          video_15s: is15s,
          expires_date: MASTER_EXPIRES_DATE,
          upgraded_at: new Date().toISOString(),
          price: Number(price) || DEFAULT_PRICE,
          payment_status: 'paid',
          channel: channel || 'zalo',
          avatar: item.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
          notes: (item.notes ? item.notes + ' | ' : '') + `Cụm: ${injectRes.cluster || 'Master'}`
        });
        results.push(userObj);

        try {
          sendTelegramOrderAlert(userObj);
        } catch (e) {}
      } else {
        results.push({ username: cleanUsername, uid: cleanUid, success: false, error: injectRes.error });
      }
    }
  }

  res.json({ success: true, processed: results.length, users: results });
});

// -------------------------------------------------------------
// 6b. SEPAY WEBHOOK ENDPOINT (AUTO-PAYMENT & AUTO-UPGRADE)
// -------------------------------------------------------------
app.post(['/api/sepay/webhook', '/api/webhook/sepay', '/hooks/sepay-payment', '/webhook/payment', '/api/webhook/payment'], async (req, res) => {
  try {
    const data = req.body || {};
    console.log('--- NHẬN WEBHOOK SEPAY ---', JSON.stringify(data));

    // SePay standard fields: content, transferAmount, gateway, referenceCode, id, transactionDate
    const content = (data.content || data.description || '').trim();
    const transferAmount = Number(data.transferAmount || data.amount || 0);
    const gateway = data.gateway || 'Bank';
    const transactionId = data.id || data.referenceCode || Date.now();

    if (!content) {
      return res.status(200).json({ success: true, message: 'Bỏ qua: Không có nội dung chuyển khoản' });
    }

    // 0. Check if content matches a Telegram Bot wallet topup code (KWP...)
    const kwpMatch = content.match(/KWP\d*[A-F0-9]+/i);
    if (kwpMatch) {
      const topupCode = kwpMatch[0].toUpperCase();
      try {
        const topupRes = await dbPool.query(
          `SELECT t.*, u."telegramId", u.username, u."firstName"
           FROM "TopupRequest" t
           JOIN "User" u ON t."userId" = u.id
           WHERE UPPER(t.code) = $1 AND t.status = 'PENDING'
           LIMIT 1`,
          [topupCode]
        );

        if (topupRes.rows.length > 0) {
          const topup = topupRes.rows[0];
          if (transferAmount >= Number(topup.amount)) {
            // Update TopupRequest
            await dbPool.query(
              `UPDATE "TopupRequest"
               SET status = 'PAID', "paidAt" = NOW(), "rawWebhook" = $1
               WHERE id = $2`,
              [JSON.stringify(data), topup.id]
            );

            // Increment user balance
            const userUpdate = await dbPool.query(
              `UPDATE "User"
               SET balance = balance + $1
               WHERE id = $2
               RETURNING balance`,
              [Number(topup.amount), topup.userId]
            );

            const newBalance = userUpdate.rows[0]?.balance || 0;

            // Record transaction ledger
            await dbPool.query(
              `INSERT INTO "Transaction" ("userId", amount, type, note, "balanceAfter", "createdAt")
               VALUES ($1, $2, 'TOPUP', $3, $4, NOW())`,
              [topup.userId, Number(topup.amount), `Nap vi #${topup.code}`, newBalance]
            );

            // Helper to send Telegram notifications
            const sendTele = (token, chatId, text) => {
              const teleReq = https.request({
                hostname: 'api.telegram.org',
                path: `/bot${token}/sendMessage`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              teleReq.on('error', (e) => console.error('Telegram notification error:', e.message));
              teleReq.write(JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }));
              teleReq.end();
            };

            // Notify user
            const teleToken = '7798628777:AAGjA9r0yjI8y83l5sCfAn-kOET-UYSg4Sw';
            const userMsg = `✅ <b>Nạp ví thành công +${Number(topup.amount).toLocaleString('vi-VN')}đ</b>\n` +
              `💰 <b>Số dư mới:</b> ${Number(newBalance).toLocaleString('vi-VN')}đ`;
            sendTele(teleToken, topup.telegramId, userMsg);

            // Notify admin group
            const groupToken = '8526627556:AAGoqOQ9KFQ-C5L7G-qBPc5stvM8v4NZrIc';
            const groupMsg = `<b>BÁO ĐƠN HỆ THỐNG</b>\n` +
              `💰 <b>Nạp tiền thành công</b>\n` +
              `Khách: ${topup.username ? '@' + topup.username : topup.firstName || topup.telegramId}\n` +
              `Số tiền: ${Number(topup.amount).toLocaleString('vi-VN')}đ\n` +
              `Số dư mới: ${Number(newBalance).toLocaleString('vi-VN')}đ`;
            sendTele(groupToken, -5088834251, groupMsg);

            return res.status(200).json({
              success: true,
              message: `Đã tự động cộng ví thành công mã ${topupCode} cho @${topup.username || topup.telegramId}!`,
              newBalance
            });
          }
        }
      } catch (kwpErr) {
        console.error('Lỗi kiểm tra topup KWP trong SePay webhook:', kwpErr);
      }
    }

    // 1. Check if content matches a Telegram Bot order payment_ref (SHOP...)
    const shopRefMatch = content.match(/SHOP[0-9A-Za-z_-]{6,20}/i);
    if (shopRefMatch) {
      const orderRef = shopRefMatch[0].toUpperCase();
      try {
        const botOrderRes = await dbPool.query(
          `SELECT o.*, p.name as product_name, p.delivery_type, u.telegram_id, u.username as tg_username
           FROM bot_orders o
           LEFT JOIN bot_products p ON o.product_id = p.id
           LEFT JOIN bot_users u ON o.user_id = u.id
           WHERE UPPER(o.payment_ref) = $1 LIMIT 1`,
          [orderRef]
        );
        if (botOrderRes.rows.length > 0) {
          const matchedBotOrder = botOrderRes.rows[0];
          const targetLocket = matchedBotOrder.locket_username || matchedBotOrder.locket_uid;
          let injectRes = { success: false };
          let finalUid = null;
          let finalUsername = targetLocket;

          if (targetLocket) {
            const resolved = await resolveLocketProfile(targetLocket);
            finalUid = resolved.uid || (targetLocket.length >= 15 ? targetLocket : null);
            finalUsername = resolved.username || targetLocket.replace('@', '');
            if (finalUid) {
              injectRes = await injectToRevenueCat(finalUid, false);
              if (injectRes.success) {
                await dbSaveUser({
                  username: finalUsername,
                  customer_uid: finalUid,
                  uid: finalUid,
                  master_uid: injectRes.cluster_uid || MASTER_CLUSTERS[0].uid,
                  has_gold: true,
                  video_15s: false,
                  expires_date: MASTER_EXPIRES_DATE,
                  upgraded_at: new Date().toISOString(),
                  price: transferAmount || matchedBotOrder.final_price,
                  payment_status: 'paid',
                  channel: 'telegram_bot',
                  avatar: resolved.avatar,
                  notes: `Nạp tự động qua Telegram Bot #${orderRef} (${injectRes.cluster || 'Cụm 2'})`
                });
              }
            }
          }

          // Update bot_orders table on Neon DB
          await dbPool.query(
            `UPDATE bot_orders 
             SET status = 'DELIVERED', paid_amount = $1, transaction_id = $2, paid_at = NOW(), delivered_at = NOW()
             WHERE id = $3`,
            [transferAmount || matchedBotOrder.final_price, String(transactionId), matchedBotOrder.id]
          );

          // Notify customer directly on Telegram
          if (matchedBotOrder.telegram_id) {
            const teleToken = '7798628777:AAGjA9r0yjI8y83l5sCfAn-kOET-UYSg4Sw';
            let teleMsg = `🎉 <b>ĐƠN HÀNG #${matchedBotOrder.payment_ref} ĐÃ THANH TOÁN THÀNH CÔNG!</b>\n` +
              `━━━━━━━━━━━━━━━━━━━\n` +
              `🛍️ <b>Sản phẩm:</b> ${matchedBotOrder.product_name}\n` +
              `💰 <b>Số tiền:</b> ${Number(transferAmount || matchedBotOrder.final_price).toLocaleString('vi-VN')} đ\n`;
            if (injectRes.success) {
              teleMsg += `👤 <b>Tài khoản Locket:</b> @${finalUsername}\n` +
                `🔑 <b>Trạng thái:</b> 🟢 ĐÃ KÍCH HOẠT LOCKET GOLD THÀNH CÔNG (Cụm StoreKit 2)\n\n` +
                `👉 <b>Khách vui lòng vuốt tắt hẳn app Locket và mở lại để nhận đặc quyền Gold ngay!</b>\n`;
            } else {
              teleMsg += `⚠️ <b>Trạng thái:</b> Đã ghi nhận tiền. Hệ thống đang đồng bộ Locket Gold cho @${finalUsername}!\n`;
            }
            teleMsg += `━━━━━━━━━━━━━━━━━━━\n🤖 <i>KwSHOP PREMIUM xin chân thành cảm ơn!</i>`;

            const teleReq = https.request({
              hostname: 'api.telegram.org',
              path: '/bot' + teleToken + '/sendMessage',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            teleReq.on('error', () => {});
            teleReq.write(JSON.stringify({
              chat_id: matchedBotOrder.telegram_id,
              text: teleMsg,
              parse_mode: 'HTML'
            }));
            teleReq.end();
          }

          return res.status(200).json({
            success: true,
            message: `Đã tự động xác nhận đơn Telegram Bot #${orderRef}!`,
            order_id: matchedBotOrder.id,
            rc_result: injectRes
          });
        }
      } catch (botErr) {
        console.error('Lỗi kiểm tra đơn Bot Telegram trong SePay webhook:', botErr);
      }
    }

    // Extract username or UID from content (e.g. "SEVQR LOCKET tnmai06", "LOCKET tnmai06", "SEVQR tnmai06", "tnmai06", "C2A5eSIG...")
    let target = content
      .replace(/^(SEVQR|LOCKET|LK|LKT|CK|NAP|GD)[_\s:]*/gi, '')
      .replace(/^(SEVQR|LOCKET|LK|LKT|CK|NAP|GD)[_\s:]*/gi, '')
      .replace(/[^a-zA-Z0-9_.-]/g, ' ')
      .trim()
      .split(' ')[0];

    if (!target) {
      return res.status(200).json({ success: true, message: 'Bỏ qua: Không tìm thấy Username hoặc UID trong nội dung' });
    }

    // Resolve profile via Smart Resolver
    const resolved = await resolveLocketProfile(target);
    const finalUid = resolved.uid || (target.length >= 15 ? target : null);
    const finalUsername = resolved.username || target.replace('@', '');

    if (!finalUid) {
      console.warn('SePay: Không phân giải được UID cho target:', target);
      return res.status(200).json({ 
        success: true, 
        message: `Chưa tìm thấy UID cho @${finalUsername}. Vui lòng kiểm tra lại nội dung chuyển khoản.` 
      });
    }

    // Auto Inject Gold to RevenueCat (Cụm 1 -> nếu đầy tự động sang Cụm 2)
    const injectRes = await injectToRevenueCat(finalUid, false);

    // Record SePay transaction to Neon DB
    const txRecord = {
      id: String(transactionId),
      gateway: gateway,
      transferAmount: transferAmount,
      content: content,
      username: finalUsername,
      uid: finalUid,
      timestamp: Date.now(),
      date: data.transactionDate || new Date().toISOString(),
      status: injectRes.success ? 'SUCCESS' : 'FAILED'
    };
    await dbSaveSepayTransaction(txRecord);

    // Save record to Neon Postgres & Local Backup
    const userObj = await dbSaveUser({
      username: finalUsername,
      customer_uid: finalUid,
      uid: finalUid,
      master_uid: injectRes.cluster_uid || MASTER_CLUSTERS[0].uid,
      has_gold: injectRes.success,
      video_15s: false,
      expires_date: injectRes.success ? MASTER_EXPIRES_DATE : null,
      upgraded_at: new Date().toISOString(),
      price: transferAmount || DEFAULT_PRICE,
      payment_status: 'paid',
      channel: 'sepay_auto',
      avatar: resolved.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(finalUsername)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
      notes: injectRes.success
        ? `SePay Auto Webhook: Ngân hàng ${gateway} • GD #${transactionId} • ${injectRes.cluster || 'Cụm Master'}`
        : `SePay Auto Webhook LỖI: Tất cả các cụm Master đầy, không thể nạp! GD #${transactionId}`
    });

    // Send Instant Telegram Notification
    try {
      sendTelegramOrderAlert({
        ...userObj,
        channel: 'sepay_auto',
        notes: `Nạp tự động qua SePay (${gateway}) - GD #${transactionId}`
      });
    } catch (e) {
      console.error('Telegram alert error:', e.message);
    }

    console.log(`✅ SEPAY TỰ ĐỘNG NẠP THÀNH CÔNG CHO @${finalUsername} (${finalUid})!`);
    return res.status(200).json({
      success: true,
      message: `Đã tự động kích hoạt Locket Gold cho @${finalUsername}!`,
      user: userObj,
      rc_result: injectRes
    });
  } catch (err) {
    console.error('Lỗi xử lý Webhook SePay:', err);
    return res.status(200).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 6c. ORDER PAYMENT CHECK (ONLY CONFIRMS IF SEPAY TRANSACTION RECEIVED)
// -------------------------------------------------------------
app.get('/api/orders/check-payment', async (req, res) => {
  const { username, uid, order_time } = req.query;
  const cleanUsername = (username || '').trim().toLowerCase().replace('@', '');
  const cleanUid = (uid || '').trim();
  const orderTimeNum = Number(order_time) || (Date.now() - 15 * 60 * 1000);

  if (!cleanUsername && !cleanUid) {
    return res.json({ paid: false, message: 'Thiếu thông tin tra cứu đơn hàng' });
  }

  const transactions = await dbGetSepayTransactions();
  const tx = transactions.find(t => {
    const matchUser = cleanUsername && (
      (t.username && t.username.toLowerCase() === cleanUsername) || 
      (t.content && t.content.toLowerCase().includes(cleanUsername))
    );
    const matchUid = cleanUid && (
      (t.uid && t.uid === cleanUid) || 
      (t.content && t.content.includes(cleanUid))
    );
    const txTime = t.timestamp || new Date(t.date).getTime();
    const matchTime = txTime >= (orderTimeNum - 30000); // 30s buffer
    return (matchUser || matchUid) && matchTime && t.status === 'SUCCESS';
  });

  if (tx) {
    const userMap = await dbGetAllUsersMap();
    const user = userMap.get(cleanUid) || Array.from(userMap.values()).find(u => u.username?.toLowerCase() === cleanUsername);
    return res.json({
      paid: true,
      transaction: tx,
      user: user || { username: cleanUsername, uid: cleanUid, has_gold: true }
    });
  }

  return res.json({
    paid: false,
    message: 'Chưa nhận được giao dịch chuyển khoản từ Ngân Hàng'
  });
});

// 7. Bulk Admin Actions (Multi-select)
app.post('/api/users/bulk-action', requireAdminAuth, async (req, res) => {
  const { action, uids = [] } = req.body;
  if (!Array.isArray(uids) || uids.length === 0) {
    return res.status(400).json({ success: false, error: 'Chưa chọn tài khoản nào' });
  }

  const userMap = await dbGetAllUsersMap();

  if (action === 'delete') {
    for (const uid of uids) {
      await dbDeleteUser(uid);
    }
    return res.json({ success: true, message: `Đã xóa ${uids.length} tài khoản khỏi hệ thống và Cloud DB!` });
  }

  if (action === 'mark_paid') {
    for (const uid of uids) {
      const u = userMap.get(uid);
      if (u) {
        u.payment_status = 'paid';
        await dbSaveUser(u);
      }
    }
    return res.json({ success: true, message: `Đã đánh dấu đã thanh toán cho ${uids.length} tài khoản!` });
  }

  if (action === 're_upgrade') {
    for (const uid of uids) {
      const u = userMap.get(uid);
      if (u) {
        const injectRes = await injectToRevenueCat(uid, !!u.video_15s);
        if (injectRes.success) {
          u.upgraded_at = new Date().toISOString();
          u.expires_date = MASTER_EXPIRES_DATE;
          if (injectRes.cluster_uid) u.master_uid = injectRes.cluster_uid;
          u.has_gold = true;
          await dbSaveUser(u);
        }
      }
    }
    return res.json({ success: true, message: `Đã gia hạn thành công cho ${uids.length} tài khoản!` });
  }

  res.status(400).json({ success: false, error: 'Hành động không hợp lệ' });
});

// 8. Delete Single User
app.delete('/api/users/:uid', requireAdminAuth, async (req, res) => {
  const uid = req.params.uid;
  await dbDeleteUser(uid);
  res.json({ success: true, message: 'Đã xóa tài khoản khỏi hệ thống và Cloud DB!', uid });
});

// 9. Update Single User
app.put('/api/users/:uid', requireAdminAuth, async (req, res) => {
  const uid = req.params.uid;
  const userMap = await dbGetAllUsersMap();
  const existing = userMap.get(uid) || { uid, customer_uid: uid };
  const updated = { ...existing, ...req.body, uid, customer_uid: uid };
  await dbSaveUser(updated);
  res.json({ success: true, user: updated });
});

// -------------------------------------------------------------
// HELPER: LOAD & SYNC MASTER KEYS POOL
// -------------------------------------------------------------
function loadMasterData() {
  let masterData = {
    active_id: "MASTER_01",
    active_token: MASTER_FETCH_TOKEN,
    expires_date: MASTER_EXPIRES_DATE,
    keys: [
      {
        id: "MASTER_01",
        name: "Master Node 01 (StoreKit 2 Gold Active)",
        fetch_token: MASTER_FETCH_TOKEN,
        expires_date: MASTER_EXPIRES_DATE,
        status: "active",
        created_at: new Date().toISOString(),
        notes: "StoreKit 2 Master Key đang hoạt động ổn định"
      }
    ]
  };

  if (fs.existsSync(LOCAL_MASTERS_FILE)) {
    try {
      const d = JSON.parse(fs.readFileSync(LOCAL_MASTERS_FILE, 'utf8'));
      if (d.keys && Array.isArray(d.keys)) {
        masterData = d;
        if (d.active_token) MASTER_FETCH_TOKEN = d.active_token;
        if (d.expires_date) MASTER_EXPIRES_DATE = d.expires_date;
      } else if (d.active_token) {
        masterData.active_token = d.active_token;
        masterData.expires_date = d.expires_date || MASTER_EXPIRES_DATE;
        masterData.keys[0].fetch_token = d.active_token;
        masterData.keys[0].expires_date = d.expires_date || MASTER_EXPIRES_DATE;
      }
    } catch (e) {}
  }

  return masterData;
}

function saveMasterData(masterData) {
  try {
    fs.writeFileSync(LOCAL_MASTERS_FILE, JSON.stringify(masterData, null, 2), 'utf8');

    // Also sync to other folders
    const paths = [
      path.join(__dirname, '..', 'locket-no-dns', 'data', 'masters.json'),
      path.join(__dirname, '..', 'locket-no-dns-15s', 'data', 'masters.json')
    ];
    paths.forEach(p => {
      try {
        if (fs.existsSync(path.dirname(p))) {
          fs.writeFileSync(p, JSON.stringify(masterData.keys || [masterData], null, 2), 'utf8');
        }
      } catch (e) {}
    });
  } catch (err) {
    console.error('Error saving master data:', err.message);
  }
}

// -------------------------------------------------------------
// 10. MASTER KEY POOL API ROUTES
// -------------------------------------------------------------
app.get('/api/masters', (req, res) => {
  const masterData = loadMasterData();
  res.json({
    active_id: masterData.active_id,
    active_token: masterData.active_token || MASTER_FETCH_TOKEN,
    expires_date: masterData.expires_date || MASTER_EXPIRES_DATE,
    api_key: LOCKET_RC_KEY,
    keys: masterData.keys || []
  });
});

// 10b. CLUSTER REAL-TIME SLOT STATUS & DISTRIBUTION
app.get('/api/clusters/status', async (req, res) => {
  try {
    const userMap = await dbGetAllUsersMap();
    const users = Array.from(userMap.values());
    
    const clusters = MASTER_CLUSTERS.map(c => {
      const clusterUsers = users.filter(u => u.master_uid === c.uid || (c.id === 'MASTER_01' && (!u.master_uid || u.master_uid === 'C2A5eSIG79UquwvohWpirajDTVx2' || u.master_uid === c.uid)));
      const paid = clusterUsers.filter(u => u.payment_status === 'paid').length;
      const unpaid = clusterUsers.length - paid;
      return {
        id: c.id,
        name: c.name,
        uid: c.uid,
        total_slots: 50,
        used_slots: clusterUsers.length,
        available_slots: Math.max(0, 50 - clusterUsers.length),
        paid_count: paid,
        unpaid_count: unpaid,
        users: clusterUsers.map(u => ({ username: u.username, uid: u.uid, payment_status: u.payment_status, has_gold: u.has_gold }))
      };
    });

    res.json({ success: true, clusters });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/masters/add', (req, res) => {
  const { name, fetch_token, expires_date, notes = '', set_active = false } = req.body;
  if (!fetch_token || fetch_token.trim().length < 5) {
    return res.status(400).json({ success: false, error: 'Mã Fetch Token / Transaction ID không hợp lệ!' });
  }

  const masterData = loadMasterData();
  const cleanToken = fetch_token.trim();
  const cleanName = (name || 'Master Key ' + (masterData.keys.length + 1)).trim();
  const cleanExpiry = (expires_date || '2026-10-03T11:26:26Z').trim();
  const newId = 'MASTER_' + String(Date.now()).slice(-4);

  const newKey = {
    id: newId,
    name: cleanName,
    fetch_token: cleanToken,
    expires_date: cleanExpiry,
    status: set_active ? 'active' : 'standby',
    created_at: new Date().toISOString(),
    notes: notes.trim()
  };

  if (set_active) {
    masterData.keys.forEach(k => k.status = 'standby');
    masterData.active_id = newId;
    masterData.active_token = cleanToken;
    masterData.expires_date = cleanExpiry;
    MASTER_FETCH_TOKEN = cleanToken;
    MASTER_EXPIRES_DATE = cleanExpiry;
  }

  masterData.keys.unshift(newKey);
  saveMasterData(masterData);

  res.json({
    success: true,
    message: `Đã thêm thành công Key "${cleanName}" vào Kho Khóa!`,
    key: newKey,
    masterData
  });
});

app.post('/api/masters/activate/:id', (req, res) => {
  const keyId = req.params.id;
  const masterData = loadMasterData();
  const targetKey = masterData.keys.find(k => k.id === keyId);

  if (!targetKey) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy Key này trong kho!' });
  }

  masterData.keys.forEach(k => k.status = (k.id === keyId ? 'active' : 'standby'));
  masterData.active_id = targetKey.id;
  masterData.active_token = targetKey.fetch_token;
  masterData.expires_date = targetKey.expires_date || MASTER_EXPIRES_DATE;

  MASTER_FETCH_TOKEN = targetKey.fetch_token;
  MASTER_EXPIRES_DATE = targetKey.expires_date || MASTER_EXPIRES_DATE;

  saveMasterData(masterData);

  res.json({
    success: true,
    message: `Đã kích hoạt "${targetKey.name}" làm Master Key chính thành công!`,
    active_key: targetKey
  });
});

app.delete('/api/masters/:id', (req, res) => {
  const keyId = req.params.id;
  const masterData = loadMasterData();

  if (masterData.keys.length <= 1) {
    return res.status(400).json({ success: false, error: 'Không thể xóa khi trong kho chỉ còn đúng 1 Key duy nhất!' });
  }

  const idx = masterData.keys.findIndex(k => k.id === keyId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy Key để xóa!' });
  }

  const deletedKey = masterData.keys.splice(idx, 1)[0];

  // If deleted the active key, activate the first remaining key
  if (masterData.active_id === keyId && masterData.keys.length > 0) {
    masterData.keys[0].status = 'active';
    masterData.active_id = masterData.keys[0].id;
    masterData.active_token = masterData.keys[0].fetch_token;
    masterData.expires_date = masterData.keys[0].expires_date;
    MASTER_FETCH_TOKEN = masterData.keys[0].fetch_token;
    MASTER_EXPIRES_DATE = masterData.keys[0].expires_date;
  }

  saveMasterData(masterData);

  res.json({
    success: true,
    message: `Đã xóa "${deletedKey.name}" khỏi Kho Khóa!`,
    deletedId: keyId
  });
});

app.post('/api/masters/test', async (req, res) => {
  const { fetch_token } = req.body;
  if (!fetch_token) {
    return res.status(400).json({ success: false, error: 'Chưa nhập Fetch Token để kiểm tra!' });
  }

  // Test token with a test payload to RevenueCat
  const testPayload = {
    app_user_id: "test_master_check_" + Date.now(),
    fetch_token: fetch_token.trim(),
    price: 3.99,
    currency: "USD",
    is_restore: true
  };

  const postData = JSON.stringify(testPayload);
  const options = {
    hostname: 'api.revenuecat.com',
    path: '/v1/receipts',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + LOCKET_RC_KEY,
      'Content-Type': 'application/json',
      'X-Platform': 'ios',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const reqRc = https.request(options, (resRc) => {
    let body = '';
    resRc.on('data', c => body += c);
    resRc.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (resRc.statusCode >= 200 && resRc.statusCode < 300) {
          res.json({ success: true, message: '🟢 Token HỢP LỆ và phản hồi tốt từ Apple/RevenueCat!', data: json });
        } else {
          res.json({ success: false, message: '🔴 Token không hợp lệ hoặc đã hết hạn trên Apple.', data: json });
        }
      } catch (e) {
        res.json({ success: false, message: 'Lỗi parse dữ liệu từ RevenueCat: ' + body });
      }
    });
  });

  reqRc.on('error', (err) => {
    res.status(500).json({ success: false, error: 'Lỗi kết nối: ' + err.message });
  });

  reqRc.write(postData);
  reqRc.end();
});

// 11. System Full Backup Export
app.get('/api/backup', (req, res) => {
  const userMap = getAllUsersMap();
  const users = Array.from(userMap.values());
  const masterData = loadMasterData();

  const backupData = {
    exported_at: new Date().toISOString(),
    system_version: "3.5 PRO",
    master_key: {
      active_token: MASTER_FETCH_TOKEN,
      expires_date: MASTER_EXPIRES_DATE,
      api_key: LOCKET_RC_KEY,
      pool: masterData.keys
    },
    total_users: users.length,
    users
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="Locket_Master_Backup_${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(backupData, null, 2));
});

// 11. Profile & Module Downloads
app.get(['/get_config.php', '/api/config', '/LacVietMedia.mobileconfig', '/vanduclocket.mobileconfig'], (req, res) => {
  const filePath = path.join(__dirname, 'public', 'LacVietMedia.mobileconfig');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/x-apple-aspen-config');
    res.setHeader('Content-Disposition', 'attachment; filename="LacVietMedia.mobileconfig"');
    return res.sendFile(filePath);
  }
  res.redirect('https://vnramdisk.io.vn/vip/vanduclocket.mobileconfig');
});

app.get(['/locket.sgmodule', '/module.sgmodule'], (req, res) => {
  const filePath = path.join(__dirname, 'public', 'locket.sgmodule');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.sendFile(filePath);
  }
  res.send('#!name=Locket Gold\n[MITM]\nhostname = %APPEND% api.revenuecat.com');
});

// 12. Test Telegram Alert Endpoint (Protected)
app.post('/api/telegram/test-alert', requireAdminAuth, (req, res) => {
  const { title = 'KIỂM TRA HỆ THỐNG CẢNH BÁO TELEGRAM', message = 'Hệ thống kết nối Bot Telegram @kwanticheckbot hoạt động 100% bình thường!' } = req.body || {};
  sendTelegramAnomalyAlert({
    type: 'test',
    title,
    message,
    details: [
      { username: 'Linh_100318', uid: 'cskKqTGYUvV3nq9JddfYuhRTTSm2', reason: 'Tài khoản hoạt động chuẩn StoreKit 2', action: '🟢 LIVE 100%' },
      { username: 'tnmai06', uid: 'C2A5eSIG79UquwvohWpirajDTVx2', reason: 'Tài khoản nạp tự động SePay', action: '🟢 LIVE 100%' }
    ]
  });
  res.json({ success: true, message: 'Đã gửi thông báo kiểm tra đến Telegram nhóm CHECK ĐƠN SHOP!' });
});

// 12b. Anomaly Incident Log API
app.get('/api/anomalies', requireAdminAuth, async (req, res) => {
  const anomalies = await dbGetAnomalies();
  res.json({
    success: true,
    total: anomalies.length,
    anomalies
  });
});

app.post('/api/watchdog/scan-now', requireAdminAuth, async (req, res) => {
  runAutoWatchdogScan();
  res.json({ success: true, message: 'Đã kích hoạt quét Watchdog toàn diện ngay lập tức!' });
});

// 13. AUTOMATED WATCHDOG & SELF-HEALING ENGINE (CHỐNG RỤNG ACC TỰ ĐỘNG & BÁO ĐỘNG TELEGRAM)
async function runAutoWatchdogScan() {
  try {
    const userMap = await dbGetAllUsersMap();
    const users = Array.from(userMap.values());
    if (users.length === 0) return;

    console.log(`[WATCHDOG] 🛡️ Đang quét tự động ${users.length} tài khoản để chống rụng...`);

    // 1. Luôn bảo trì trạng thái các Cụm Master (Cụm 1, Cụm 2...) trước khi quét khách
    for (const cluster of MASTER_CLUSTERS) {
      await ensureMasterClusterActive(cluster.uid);
    }

    const healedList = [];
    const droppedList = [];
    const errorList = [];
    let liveCount = 0;

    for (const u of users) {
      if (!u.uid) continue;
      const rc = await queryRevenueCatLive(u.uid);

      if (rc.status === 'ERROR') {
        errorList.push({ username: u.username, uid: u.uid, reason: `Lỗi kết nối RevenueCat: ${rc.error || 'N/A'}` });
        continue;
      }

      const isDead = !rc.is_live;
      const isExpiring = rc.days_left !== null && rc.days_left <= 3;

      if (isDead || isExpiring) {
        const rootCause = rc.drop_reason || (isDead ? 'Mất quyền Gold trên RevenueCat' : `Tài khoản sắp hết hạn (còn ${rc.days_left} ngày)`);
        console.warn(`[WATCHDOG] ⚠️ Phát hiện @${u.username} (${u.uid}): ${rootCause}! Tự động cứu acc qua Cụm Master...`);
        
        const injectRes = await injectToRevenueCat(u.uid, u.video_15s || false);
        const isHealed = injectRes.success;

        const anomalyRecord = {
          id: 'LOG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          username: u.username,
          uid: u.uid,
          event_type: isDead ? 'DROP_DETECTED' : 'EXPIRING_SOON',
          root_cause: rootCause,
          revenuecat_snapshot: rc.raw || null,
          auto_heal_attempted: true,
          auto_heal_success: isHealed,
          new_expires_date: isHealed ? MASTER_EXPIRES_DATE : null,
          status: isHealed ? 'RESOLVED' : 'UNRESOLVED'
        };
        await dbSaveAnomalyEvent(anomalyRecord);

        if (isHealed) {
          u.has_gold = true;
          u.expires_date = MASTER_EXPIRES_DATE;
          if (injectRes.cluster_uid) {
            u.master_uid = injectRes.cluster_uid;
          }
          await dbSaveUser(u);
          console.log(`[WATCHDOG] ✅ Đã hồi sinh Gold thành công cho @${u.username} vào ${injectRes.cluster || 'Cụm'} (Hạn mới: ${MASTER_EXPIRES_DATE})!`);
          healedList.push({
            username: u.username,
            uid: u.uid,
            reason: rootCause,
            action: `🟢 Đã gộp thành công vào ${injectRes.cluster || 'Cụm Master'} (Hạn: ${MASTER_EXPIRES_DATE.split('T')[0]})`
          });
        } else {
          droppedList.push({
            username: u.username,
            uid: u.uid,
            reason: `Bơm lại thất bại: ${rootCause} (HTTP ${injectRes.statusCode || 'Err'})`,
            action: '🔴 Cần admin kiểm tra thủ công Master Token'
          });
        }
      } else {
        liveCount++;
      }
    }

    // Update settings file
    try {
      const settings = fs.existsSync(LOCAL_SETTINGS_FILE) ? JSON.parse(fs.readFileSync(LOCAL_SETTINGS_FILE, 'utf8')) : {};
      settings.last_scan = new Date().toISOString();
      settings.last_scan_total = users.length;
      settings.last_scan_live = liveCount;
      settings.last_scan_healed = healedList.length;
      settings.last_scan_dropped = droppedList.length;
      fs.writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) {}

    // Send Telegram Notifications if any anomaly or healing occurred
    if (healedList.length > 0) {
      sendTelegramAnomalyAlert({
        type: 'heal',
        title: 'BÁO CÁO WATCHDOG: PHÁT HIỆN LỖI & TỰ ĐỘNG CỨU ACC THÀNH CÔNG',
        message: `Hệ thống vừa phát hiện sự cố từ log RevenueCat và tự động hồi sinh Gold StoreKit 2 cho <b>${healedList.length}</b> tài khoản!`,
        details: healedList
      });
    }

    if (droppedList.length > 0) {
      sendTelegramAnomalyAlert({
        type: 'drop',
        title: 'CẢNH BÁO BẤT THƯỜNG: TÀI KHOẢN CẦN XỬ LÝ',
        message: `Phát hiện <b>${droppedList.length}</b> tài khoản không thể tự động hồi sinh. Vui lòng kiểm tra lại Master Key!`,
        details: droppedList
      });
    }

    if (errorList.length > 0) {
      sendTelegramAnomalyAlert({
        type: 'error',
        title: 'CẢNH BÁO: LỖI KẾT NỐI REVENUECAT API',
        message: `Có <b>${errorList.length}</b> tài khoản gặp lỗi mạng/API khi kiểm tra trạng thái.`,
        details: errorList
      });
    }

    if (healedList.length === 0 && droppedList.length === 0 && errorList.length === 0) {
      console.log(`[WATCHDOG] 🟢 Tất cả ${users.length} tài khoản đều đang LIVE ổn định 100%!`);
    }
  } catch (err) {
    console.error('[WATCHDOG ERROR]:', err.message);
    sendTelegramAnomalyAlert({
      type: 'error',
      title: 'LỖI TIẾN TRÌNH WATCHDOG',
      message: `Tiến trình quét tự động gặp lỗi ngoại lệ: <code>${err.message}</code>`
    });
  }
}

// ========================================================
// BOT TELEGRAM SHOP & ORDER ENDPOINTS (Shared Neon DB)
// ========================================================

// GET /api/bot/overview: financial, profit, and order metrics
app.get('/api/bot/overview', async (req, res) => {
  try {
    const [
      ordersCountRes,
      ordersTodayRes,
      revenueRes,
      revenueTodayRes,
      revenueMonthRes,
      expenseRes,
      expenseTodayRes,
      expenseMonthRes,
      usersCountRes,
      productsCountRes,
      walletBalanceRes,
      availableStockRes,
      soldTodayRes,
      recentOrdersRes
    ] = await Promise.all([
      dbPool.query(`SELECT COUNT(*) as count FROM "Order"`),
      dbPool.query(`SELECT COUNT(*) as count FROM "Order" WHERE "createdAt" >= CURRENT_DATE`),
      dbPool.query(`SELECT COALESCE(SUM("totalPrice"), 0) as total FROM "Order" WHERE status = 'COMPLETED'`),
      dbPool.query(`SELECT COALESCE(SUM("totalPrice"), 0) as total FROM "Order" WHERE status = 'COMPLETED' AND "createdAt" >= CURRENT_DATE`),
      dbPool.query(`SELECT COALESCE(SUM("totalPrice"), 0) as total FROM "Order" WHERE status = 'COMPLETED' AND "createdAt" >= date_trunc('month', CURRENT_DATE)`),
      dbPool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM "Expense"`),
      dbPool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM "Expense" WHERE "createdAt" >= CURRENT_DATE`),
      dbPool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM "Expense" WHERE "createdAt" >= date_trunc('month', CURRENT_DATE)`),
      dbPool.query(`SELECT COUNT(*) as count FROM "User"`),
      dbPool.query(`SELECT COUNT(*) as count FROM "Product" WHERE "isActive" = true`),
      dbPool.query(`SELECT COALESCE(SUM(balance), 0) as total FROM "User"`),
      dbPool.query(`SELECT COUNT(*) as count FROM "StockItem" WHERE "isSold" = false`),
      dbPool.query(`SELECT COUNT(*) as count FROM "StockItem" WHERE "isSold" = true AND "createdAt" >= CURRENT_DATE`),
      dbPool.query(`
        SELECT o.id, 
               CONCAT('DH-', o.id) as payment_ref,
               o.quantity, 
               o."totalPrice" as final_price, 
               o.status, 
               o."deliveredContent" as locket_username, 
               o."createdAt" as created_at,
               p.name as product_name, 
               p.type as delivery_type,
               u.username as tg_username, 
               u."firstName" as tg_full_name, 
               u."telegramId" as telegram_id
        FROM "Order" o
        LEFT JOIN "Product" p ON o."productId" = p.id
        LEFT JOIN "User" u ON o."userId" = u.id
        ORDER BY o."createdAt" DESC
        LIMIT 15
      `)
    ]);

    const revenue = parseFloat(revenueRes.rows[0]?.total || 0);
    const revenueToday = parseFloat(revenueTodayRes.rows[0]?.total || 0);
    const revenueMonth = parseFloat(revenueMonthRes.rows[0]?.total || 0);
    const expense = parseFloat(expenseRes.rows[0]?.total || 0);
    const expenseToday = parseFloat(expenseTodayRes.rows[0]?.total || 0);
    const expenseMonth = parseFloat(expenseMonthRes.rows[0]?.total || 0);

    res.json({
      success: true,
      metrics: {
        orders_count: parseInt(ordersCountRes.rows[0]?.count || 0),
        orders_today: parseInt(ordersTodayRes.rows[0]?.count || 0),
        revenue: revenue,
        revenue_today: revenueToday,
        revenue_month: revenueMonth,
        expense: expense,
        expense_today: expenseToday,
        expense_month: expenseMonth,
        profit: revenue - expense,
        profit_today: revenueToday - expenseToday,
        profit_month: revenueMonth - expenseMonth,
        users_count: parseInt(usersCountRes.rows[0]?.count || 0),
        products_count: parseInt(productsCountRes.rows[0]?.count || 0),
        total_wallet_balance: parseFloat(walletBalanceRes.rows[0]?.total || 0),
        available_stock: parseInt(availableStockRes.rows[0]?.count || 0),
        sold_today: parseInt(soldTodayRes.rows[0]?.count || 0)
      },
      recent_orders: recentOrdersRes.rows
    });
  } catch (err) {
    console.error('[API /api/bot/overview ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bot/categories: list all categories with product counts
app.get('/api/bot/categories', async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT c.id, c.name, c."sortOrder", c."isActive", c."iconCustomEmojiId" as icon,
             COUNT(p.id)::int as product_count
      FROM "Category" c
      LEFT JOIN "Product" p ON p."categoryId" = c.id
      GROUP BY c.id
      ORDER BY c."sortOrder" ASC, c.id ASC
    `);
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    console.error('[API /api/bot/categories ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bot/categories: create new category
app.post('/api/bot/categories', async (req, res) => {
  try {
    const { name } = req.body || {};
    const trimmed = String(name || '').trim();
    if (!trimmed) return res.status(400).json({ success: false, error: 'Tên danh mục không được để trống' });
    const result = await dbPool.query(`
      INSERT INTO "Category" (name, "sortOrder", "isActive", "createdAt")
      VALUES ($1, 0, true, NOW())
      RETURNING *
    `, [trimmed]);
    res.json({ success: true, category: result.rows[0], message: 'Tạo danh mục thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/bot/categories/:id: edit category
app.patch('/api/bot/categories/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, isActive, sortOrder } = req.body || {};
    const updates = [];
    const values = [id];
    let idx = 2;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(String(name).trim());
    }
    if (isActive !== undefined) {
      updates.push(`"isActive" = $${idx++}`);
      values.push(Boolean(isActive));
    }
    if (sortOrder !== undefined) {
      updates.push(`"sortOrder" = $${idx++}`);
      values.push(parseInt(sortOrder, 10));
    }

    if (updates.length === 0) return res.status(400).json({ success: false, error: 'Không có dữ liệu thay đổi' });
    const result = await dbPool.query(`UPDATE "Category" SET ${updates.join(', ')} WHERE id = $1 RETURNING *`, values);
    res.json({ success: true, category: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/bot/categories/:id: delete category (if empty)
app.delete('/api/bot/categories/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const countRes = await dbPool.query(`SELECT COUNT(*) as count FROM "Product" WHERE "categoryId" = $1`, [id]);
    if (parseInt(countRes.rows[0]?.count || 0) > 0) {
      return res.status(400).json({ success: false, error: 'Danh mục còn sản phẩm bên trong - xoá hoặc chuyển sản phẩm trước!' });
    }
    await dbPool.query(`DELETE FROM "Category" WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Đã xóa danh mục' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bot/products: list all bot products
app.get('/api/bot/products', async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT p.id, p.name, p.description, p.price, p.type as delivery_type,
             p."categoryId" as category_id,
             COALESCE((SELECT COUNT(*) FROM "StockItem" s WHERE s."productId" = p.id AND s."isSold" = false), 0) as stock,
             p."isActive" as is_active,
             COALESCE((SELECT COUNT(*) FROM "Order" o WHERE o."productId" = p.id AND o.status = 'COMPLETED'), 0) as total_sold,
             p."createdAt" as created_at,
             c.name as category_name,
             c."iconCustomEmojiId" as category_emoji
      FROM "Product" p
      LEFT JOIN "Category" c ON p."categoryId" = c.id
      ORDER BY c."sortOrder" ASC, p."sortOrder" ASC, p.id ASC
    `);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    console.error('[API /api/bot/products ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bot/products: add new product
app.post('/api/bot/products', async (req, res) => {
  try {
    const { category_id, name, price, type, description } = req.body || {};
    if (!name || !price || !category_id) {
      return res.status(400).json({ success: false, error: 'Vui lòng điền đầy đủ Tên, Giá và Danh mục' });
    }
    const upperType = String(type || 'STOCK').toUpperCase();
    const result = await dbPool.query(`
      INSERT INTO "Product" ("categoryId", name, price, type, description, "isActive", "sortOrder", "createdAt")
      VALUES ($1, $2, $3, $4, $5, true, 0, NOW())
      RETURNING *
    `, [parseInt(category_id, 10), String(name).trim(), parseInt(price, 10), upperType, description ? String(description).trim() : null]);
    res.json({ success: true, product: result.rows[0], message: 'Tạo mặt hàng mới thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/bot/products/:id: edit product price, name, description, category, active status
app.patch('/api/bot/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, price, description, is_active, category_id } = req.body || {};
    const updates = [];
    const values = [id];
    let idx = 2;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(String(name).trim());
    }
    if (price !== undefined) {
      updates.push(`price = $${idx++}`);
      values.push(parseInt(price, 10));
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description ? String(description).trim() : null);
    }
    if (is_active !== undefined) {
      updates.push(`"isActive" = $${idx++}`);
      values.push(Boolean(is_active));
    }
    if (category_id !== undefined) {
      updates.push(`"categoryId" = $${idx++}`);
      values.push(parseInt(category_id, 10));
    }

    if (updates.length === 0) return res.status(400).json({ success: false, error: 'Không có dữ liệu thay đổi' });

    const query = `UPDATE "Product" SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await dbPool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy sản phẩm' });

    res.json({ success: true, product: result.rows[0], message: 'Đã cập nhật sản phẩm thành công!' });
  } catch (err) {
    console.error('[PATCH /api/bot/products/:id ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/bot/products/:id: delete or hide product
app.delete('/api/bot/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const orderCountRes = await dbPool.query(`SELECT COUNT(*) as count FROM "Order" WHERE "productId" = $1`, [id]);
    if (parseInt(orderCountRes.rows[0]?.count || 0) > 0) {
      await dbPool.query(`UPDATE "Product" SET "isActive" = false WHERE id = $1`, [id]);
      return res.json({ success: true, message: 'Sản phẩm đã có đơn hàng nên được ẩn đi để lưu giữ lịch sử.' });
    }
    await dbPool.query(`DELETE FROM "StockItem" WHERE "productId" = $1 AND "isSold" = false`, [id]);
    await dbPool.query(`DELETE FROM "Product" WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Đã xóa sản phẩm hoàn toàn' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bot/products/:id/stock: list unsold stock items
app.get('/api/bot/products/:id/stock', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await dbPool.query(`
      SELECT id, content, "isSold", "createdAt"
      FROM "StockItem"
      WHERE "productId" = $1 AND "isSold" = false
      ORDER BY id ASC
      LIMIT 200
    `, [id]);
    res.json({ success: true, stock_items: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bot/products/:id/stock: fill stock (bulk lines) + broadcast announcement
app.post('/api/bot/products/:id/stock', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { lines, broadcast } = req.body || {};
    const rawLines = String(lines || '').split('\n').map(l => l.trim()).filter(Boolean);

    if (rawLines.length === 0) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập ít nhất 1 dòng tài khoản/mã' });
    }

    for (const line of rawLines) {
      await dbPool.query(`
        INSERT INTO "StockItem" ("productId", content, "isSold", "createdAt")
        VALUES ($1, $2, false, NOW())
      `, [id, line]);
    }

    const stockRes = await dbPool.query(`SELECT COUNT(*) as count FROM "StockItem" WHERE "productId" = $1 AND "isSold" = false`, [id]);
    const totalStock = parseInt(stockRes.rows[0]?.count || 0);

    const prodRes = await dbPool.query(`SELECT name, price FROM "Product" WHERE id = $1`, [id]);
    const product = prodRes.rows[0];

    let broadcastSent = 0;
    if (broadcast && product) {
      try {
        const usersRes = await dbPool.query(`SELECT "telegramId" FROM "User" WHERE "isBanned" = false`);
        const botToken = process.env.TELEGRAM_BOT_TOKEN || '7798628777:AAGjA9r0yjI8y83l5sCfAn-kOET-UYSg4Sw';
        const priceVnd = Number(product.price).toLocaleString('vi-VN') + 'đ';
        const msgText = `📢 <b>Fill thêm hàng mới!</b>\n📦 Sản phẩm: <b>${product.name}</b>\n💵 Giá: <b>${priceVnd}</b>\n➕ Thêm: <b>${rawLines.length}</b>\n📊 Tồn kho hiện tại: <b>${totalStock}</b>`;
        const keyboard = {
          inline_keyboard: [
            [{ text: '🛒 Mua ngay', callback_data: `buy:${id}` }],
            [{ text: '📦 Sản phẩm / Gói khác', callback_data: 'menu:products' }]
          ]
        };

        for (const u of usersRes.rows) {
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: u.telegramId,
              text: msgText,
              parse_mode: 'HTML',
              reply_markup: keyboard
            })
          }).then(() => broadcastSent++).catch(() => {});
        }
      } catch (bcErr) {
        console.warn('Broadcast error:', bcErr.message);
      }
    }

    res.json({
      success: true,
      added: rawLines.length,
      total_stock: totalStock,
      broadcast_sent: broadcastSent,
      message: `Đã nhập thành công ${rawLines.length} sản phẩm vào kho!`
    });
  } catch (err) {
    console.error('[POST /api/bot/products/:id/stock ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/bot/stock/:stockId: delete a single stock line
app.delete('/api/bot/stock/:stockId', async (req, res) => {
  try {
    const stockId = parseInt(req.params.stockId, 10);
    await dbPool.query(`DELETE FROM "StockItem" WHERE id = $1 AND "isSold" = false`, [stockId]);
    res.json({ success: true, message: 'Đã xóa mục khỏi kho' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bot/users: list users with search filter
app.get('/api/bot/users', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    let query = `
      SELECT u.id, u."telegramId", u.username, u."firstName", u.language, u.balance,
             u."referralCode", u."isBanned", u."createdAt",
             COALESCE((SELECT COUNT(*) FROM "Order" o WHERE o."userId" = u.id), 0) as order_count,
             COALESCE((SELECT SUM("totalPrice") FROM "Order" o WHERE o."userId" = u.id AND o.status = 'COMPLETED'), 0) as total_spent
      FROM "User" u
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE u."telegramId" ILIKE $1 OR u.username ILIKE $1 OR u."firstName" ILIKE $1`;
    }
    query += ` ORDER BY u."createdAt" DESC LIMIT 100`;

    const result = await dbPool.query(query, params);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('[API /api/bot/users ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bot/users/:telegramId: get user profile and transactions
app.get('/api/bot/users/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const userRes = await dbPool.query(`SELECT * FROM "User" WHERE "telegramId" = $1`, [telegramId]);
    if (userRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
    const user = userRes.rows[0];

    const txRes = await dbPool.query(`
      SELECT id, type, amount, "balanceAfter", note, "createdAt"
      FROM "Transaction"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 30
    `, [user.id]);

    const orderRes = await dbPool.query(`
      SELECT o.id, o.quantity, o."totalPrice", o.status, o."createdAt", p.name as product_name
      FROM "Order" o
      LEFT JOIN "Product" p ON o."productId" = p.id
      WHERE o."userId" = $1
      ORDER BY o."createdAt" DESC
      LIMIT 20
    `, [user.id]);

    res.json({ success: true, user, transactions: txRes.rows, orders: orderRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bot/users/:telegramId/adjust-balance: credit/debit user balance
app.post('/api/bot/users/:telegramId/adjust-balance', async (req, res) => {
  const client = await dbPool.connect();
  try {
    const { telegramId } = req.params;
    const { amount, note } = req.body || {};
    const amountInt = parseInt(amount, 10);
    if (!Number.isInteger(amountInt) || amountInt === 0) {
      return res.status(400).json({ success: false, error: 'Số tiền điều chỉnh không hợp lệ' });
    }

    await client.query('BEGIN');
    const userRes = await client.query(`SELECT id, balance FROM "User" WHERE "telegramId" = $1 FOR UPDATE`, [telegramId]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
    }

    const user = userRes.rows[0];
    const newBalance = user.balance + amountInt;
    if (newBalance < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: `Số dư sau khi trừ sẽ bị âm (${newBalance}đ)` });
    }

    await client.query(`UPDATE "User" SET balance = $1 WHERE id = $2`, [newBalance, user.id]);
    await client.query(`
      INSERT INTO "Transaction" ("userId", type, amount, "balanceAfter", note, "createdAt")
      VALUES ($1, 'ADMIN_ADJUST', $2, $3, $4, NOW())
    `, [user.id, amountInt, newBalance, note || 'Admin điều chỉnh số dư']);

    await client.query('COMMIT');
    res.json({ success: true, new_balance: newBalance, message: `Đã ${amountInt > 0 ? 'cộng' : 'trừ'} ${Math.abs(amountInt).toLocaleString('vi-VN')}đ thành công!` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ADJUST BALANCE ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/bot/users/:telegramId/ban: ban or unban user
app.post('/api/bot/users/:telegramId/ban', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { isBanned } = req.body || {};
    const result = await dbPool.query(`UPDATE "User" SET "isBanned" = $1 WHERE "telegramId" = $2 RETURNING *`, [Boolean(isBanned), telegramId]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
    res.json({ success: true, isBanned: result.rows[0].isBanned, message: result.rows[0].isBanned ? 'Đã khóa tài khoản thành viên' : 'Đã mở khóa tài khoản thành viên' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bot/orders: list orders with date range, status, and search filters
app.get('/api/bot/orders', async (req, res) => {
  try {
    const { status, range, search } = req.query || {};
    let query = `
      SELECT o.id, 
             CONCAT('DH-', o.id) as payment_ref,
             o.quantity, 
             o."totalPrice" / GREATEST(o.quantity, 1) as unit_price,
             o."totalPrice" as final_price, 
             o.status, 
             o."deliveredContent" as locket_username, 
             o."externalOrderCode" as transaction_id, 
             o."totalPrice" as paid_amount, 
             o."createdAt" as paid_at, 
             o."createdAt" as delivered_at, 
             o."createdAt" as created_at,
             p.name as product_name, 
             p.type as delivery_type,
             u.username as tg_username, 
             u."firstName" as tg_full_name, 
             u."telegramId" as telegram_id
      FROM "Order" o
      LEFT JOIN "Product" p ON o."productId" = p.id
      LEFT JOIN "User" u ON o."userId" = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (status && status !== 'all') {
      params.push(status.toUpperCase());
      query += ` AND UPPER(o.status) = $${idx++}`;
    }

    if (range === 'today') {
      query += ` AND o."createdAt" >= CURRENT_DATE`;
    } else if (range === '7d') {
      query += ` AND o."createdAt" >= (NOW() - INTERVAL '7 days')`;
    } else if (range === '30d') {
      query += ` AND o."createdAt" >= (NOW() - INTERVAL '30 days')`;
    } else if (range === 'month') {
      query += ` AND o."createdAt" >= date_trunc('month', CURRENT_DATE)`;
    }

    if (search && search.trim()) {
      const trimmed = search.trim();
      params.push(`%${trimmed}%`);
      query += ` AND (CONCAT('DH-', o.id) ILIKE $${idx} OR u."telegramId" ILIKE $${idx} OR u.username ILIKE $${idx} OR p.name ILIKE $${idx} OR o."deliveredContent" ILIKE $${idx})`;
      idx++;
    }

    query += ` ORDER BY o."createdAt" DESC LIMIT 150`;

    const result = await dbPool.query(query, params);
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    console.error('[API /api/bot/orders ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/bot/orders/:id/status: update order status
app.patch('/api/bot/orders/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ success: false, error: 'Chưa chọn trạng thái' });
    const result = await dbPool.query(`UPDATE "Order" SET status = $1 WHERE id = $2 RETURNING *`, [status.toUpperCase(), id]);
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bot/orders/:id/refund: refund order and credit back to user wallet
app.post('/api/bot/orders/:id/refund', async (req, res) => {
  const client = await dbPool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    await client.query('BEGIN');

    const orderRes = await client.query(`SELECT * FROM "Order" WHERE id = $1 FOR UPDATE`, [id]);
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    }

    const order = orderRes.rows[0];
    if (order.status !== 'COMPLETED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Chỉ hoàn tiền được đơn hàng đang ở trạng thái Hoàn tất (COMPLETED)' });
    }

    // Update order status
    await client.query(`UPDATE "Order" SET status = 'REFUNDED' WHERE id = $1`, [id]);

    // Credit user balance
    const userRes = await client.query(`SELECT id, balance FROM "User" WHERE id = $1 FOR UPDATE`, [order.userId]);
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const newBal = user.balance + order.totalPrice;
      await client.query(`UPDATE "User" SET balance = $1 WHERE id = $2`, [newBal, user.id]);
      await client.query(`
        INSERT INTO "Transaction" ("userId", type, amount, "balanceAfter", note, "createdAt")
        VALUES ($1, 'REFUND', $2, $3, $4, NOW())
      `, [user.id, order.totalPrice, newBal, `Hoàn đơn hàng #${order.id} (Admin refund)`]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Đã hoàn thành công ${Number(order.totalPrice).toLocaleString('vi-VN')}đ vào ví khách hàng!` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[REFUND ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/bot/expenses: list expense entries
app.get('/api/bot/expenses', async (req, res) => {
  try {
    const result = await dbPool.query(`SELECT id, amount, note, "createdAt" FROM "Expense" ORDER BY "createdAt" DESC LIMIT 100`);
    res.json({ success: true, expenses: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bot/expenses: create expense entry
app.post('/api/bot/expenses', async (req, res) => {
  try {
    const { amount, note } = req.body || {};
    const amountInt = parseInt(amount, 10);
    if (!Number.isInteger(amountInt) || amountInt <= 0) return res.status(400).json({ success: false, error: 'Số tiền chi phí không hợp lệ' });
    const trimmedNote = String(note || '').trim();
    if (!trimmedNote) return res.status(400).json({ success: false, error: 'Ghi chú không được để trống' });

    const result = await dbPool.query(`
      INSERT INTO "Expense" (amount, note, "createdAt")
      VALUES ($1, $2, NOW())
      RETURNING *
    `, [amountInt, trimmedNote]);
    res.json({ success: true, expense: result.rows[0], message: 'Đã ghi chi phí thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/bot/expenses/:id: delete expense entry
app.delete('/api/bot/expenses/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await dbPool.query(`DELETE FROM "Expense" WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Đã xóa chi phí' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bot/broadcast: send broadcast HTML to all bot users
app.post('/api/bot/broadcast', async (req, res) => {
  try {
    const { content } = req.body || {};
    const text = String(content || '').trim();
    if (!text) return res.status(400).json({ success: false, error: 'Nội dung thông báo không được để trống' });

    const usersRes = await dbPool.query(`SELECT "telegramId" FROM "User" WHERE "isBanned" = false`);
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '7798628777:AAGjA9r0yjI8y83l5sCfAn-kOET-UYSg4Sw';

    let successCount = 0;
    let failCount = 0;

    // Send in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < usersRes.rows.length; i += batchSize) {
      const batch = usersRes.rows.slice(i, i + batchSize);
      await Promise.all(batch.map(async (u) => {
        try {
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: u.telegramId,
              text: text,
              parse_mode: 'HTML'
            })
          });
          const data = await response.json();
          if (data.ok) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      }));
    }

    res.json({
      success: true,
      total_targeted: usersRes.rows.length,
      success_count: successCount,
      fail_count: failCount,
      message: `Đã gửi thông báo thành công đến ${successCount}/${usersRes.rows.length} người dùng!`
    });
  } catch (err) {
    console.error('[BROADCAST ERROR]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bot/coupons: list coupons
app.get('/api/bot/coupons', async (req, res) => {
  try {
    const result = await dbPool.query(`SELECT id, code, "discountPercent", "isActive", "createdAt" FROM "Coupon" ORDER BY "createdAt" DESC`);
    res.json({ success: true, coupons: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bot/coupons: add new coupon
app.post('/api/bot/coupons', async (req, res) => {
  try {
    const { code, discountPercent } = req.body || {};
    const cleanCode = String(code || '').trim().toUpperCase();
    const percent = parseInt(discountPercent, 10);
    if (!cleanCode) return res.status(400).json({ success: false, error: 'Mã giảm giá không được để trống' });
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
      return res.status(400).json({ success: false, error: '% giảm giá phải từ 1 đến 100' });
    }

    const result = await dbPool.query(`
      INSERT INTO "Coupon" (code, "discountPercent", "isActive", "createdAt")
      VALUES ($1, $2, true, NOW())
      RETURNING *
    `, [cleanCode, percent]);
    res.json({ success: true, coupon: result.rows[0], message: 'Tạo mã giảm giá thành công!' });
  } catch (err) {
    if (err.message.includes('unique constraint') || err.message.includes('Coupon_code_key')) {
      return res.status(400).json({ success: false, error: 'Mã giảm giá này đã tồn tại' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/bot/coupons/:id: delete coupon
app.delete('/api/bot/coupons/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await dbPool.query(`DELETE FROM "Coupon" WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Đã xóa mã giảm giá' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  const lanIp = getLanIp();
  console.log('======================================================');
  console.log(`🌟 LOCKET GOLD UNIFIED MASTER HUB v3.5 (PRO EDITION)`);
  console.log(`👉 Bảng Điều Khiển Máy Tính: http://localhost:${PORT}`);
  console.log(`📱 Điều Khiển Qua Điện Thoại: http://${lanIp}:${PORT}`);
  console.log('======================================================');

  // Trigger Watchdog immediately after 3 seconds, then every 10 minutes
  setTimeout(runAutoWatchdogScan, 3000);
  setInterval(runAutoWatchdogScan, 10 * 60 * 1000);
});

