const express = require('express');
require('dotenv').config();
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
// Serve static frontend files from /public
app.use(express.static('public'));

// Simple in-memory token store (not for production)
const tokens = new Map();

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const token = auth.slice(7);
  const user = tokens.get(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid token' });
  req.user = user;
  next();
}

app.get('/test', async (req, res) => {
  try {
    const result = await db.query('SELECT 1 AS connected');
    res.json({ ok: true, rows: result.recordset });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Login: checks USER table for username/password and returns a token
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password required' });
    const q = 'SELECT TOP 1 * FROM dbo.[USER] WHERE UserName = @username AND UserPass = @password';
    const result = await db.query(q, { username, password });
    if (!result.recordset || result.recordset.length === 0) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    const userRow = result.recordset[0];
    // avoid returning password in response
    const user = { ...userRow };
    for (const k of Object.keys(user)) {
      if (k.toLowerCase().includes('pass')) delete user[k];
    }
    // create simple token
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const id = user.UserID || user.ID || user.Id || user.userId || user.UserId || null;
    const usernameOut = user.Username || user.UserName || user.username || null;
    const fullName = user.FullName || user.Fullname || user.Name || user.name || null;
    tokens.set(token, { id, username: usernameOut, fullName });
    res.json({ ok: true, token, user: { id, username: usernameOut, fullName } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// debug endpoints removed

app.get('/tables', requireAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT TOP 50 TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_NAME");
    res.json({ ok: true, tables: result.recordset });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Accounts (Chart of Accounts)
app.get('/accounts', requireAuth, async (req, res) => {
  try {
    const q = 'SELECT TOP 500 * FROM dbo.ACC';
    const result = await db.query(q);
    res.json({ ok: true, accounts: result.recordset });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function getCategColumnInfo() {
  const q = "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='CATEG' ORDER BY ORDINAL_POSITION";
  const r = await db.query(q);
  return r.recordset.map(row => ({ name: row.COLUMN_NAME, data_type: row.DATA_TYPE }));
}

app.get('/categories', requireAuth, async (req, res) => {
  try {
    const cols = await getCategColumnInfo();
    const idCol = cols.find(c => /CategID/i.test(c.name)) || cols.find(c => /id$/i.test(c.name));
    if (!idCol) return res.status(400).json({ ok: false, error: 'No CategID or id column found in CATEG' });
    const labelCol = cols.find(c => /name$/i.test(c.name)) || cols.find(c => /desc/i.test(c.name)) || idCol;
    const q = `SELECT TOP 200 [${idCol.name}] AS id, [${labelCol.name}] AS label FROM dbo.CATEG ORDER BY [${idCol.name}]`;
    const result = await db.query(q);
    res.json({ ok: true, categories: result.recordset });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Helper: get columns for ACC table with data types
async function getAccColumns() {
  const q = "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ACC' ORDER BY ORDINAL_POSITION";
  const r = await db.query(q);
  return r.recordset.map(r => ({ name: r.COLUMN_NAME, data_type: r.DATA_TYPE }));
}

function normalizeValue(value, dataType) {
  if (value === null || value === undefined || value === '') return null;
  const type = dataType.toLowerCase();
  if (type === 'bit') {
    if (typeof value === 'boolean') return value;
    if (value === '1' || value === 1 || value === 'true' || value === true) return true;
    if (value === '0' || value === 0 || value === 'false' || value === false) return false;
    return Boolean(value);
  }
  if (['int','smallint','bigint','tinyint','decimal','numeric','float','real','money','smallmoney'].includes(type)) {
    const num = Number(value);
    if (Number.isNaN(num)) throw new Error(`Invalid numeric value for type ${dataType}: ${value}`);
    return num;
  }
  return value;
}

// Create account
app.post('/accounts', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const cols = await getAccColumns();
    const colMap = new Map(cols.map(c => [c.name, c]));
    const insertCols = Object.keys(body).filter(k => colMap.has(k));
    if (insertCols.length === 0) return res.status(400).json({ ok: false, error: 'No valid columns provided' });
    const colList = insertCols.map(c => `[${c}]`).join(',');
    const paramList = insertCols.map(c => `@${c}`).join(',');
    const q = `INSERT INTO dbo.ACC (${colList}) VALUES (${paramList}); SELECT SCOPE_IDENTITY() AS id;`;
    const params = {};
    insertCols.forEach(c => {
      const { data_type } = colMap.get(c);
      params[c] = normalizeValue(body[c], data_type);
    });
    const result = await db.query(q, params);
    const id = result.recordset && result.recordset[0] && result.recordset[0].id;
    res.json({ ok: true, id: id || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update account by id (detect pk)
app.put('/accounts/:id', requireAuth, async (req, res) => {
  try {
    const idVal = req.params.id;
    const body = req.body || {};
    const cols = await getAccColumns();
    if (cols.length === 0) return res.status(400).json({ ok: false, error: 'ACC table has no columns' });
    const colMap = new Map(cols.map(c => [c.name, c]));
    const pk = cols.find(c => /id$/i.test(c.name)) || cols[0];
    const updateCols = Object.keys(body).filter(k => colMap.has(k) && k !== pk.name);
    if (updateCols.length === 0) return res.status(400).json({ ok: false, error: 'No valid columns to update' });
    const setList = updateCols.map(c => `[${c}]=@${c}`).join(',');
    const q = `UPDATE dbo.ACC SET ${setList} WHERE [${pk.name}] = @__id`;
    const params = { __id: normalizeValue(idVal, pk.data_type) };
    updateCols.forEach(c => {
      const { data_type } = colMap.get(c);
      params[c] = normalizeValue(body[c], data_type);
    });
    await db.query(q, params);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete account by id
app.delete('/accounts/:id', requireAuth, async (req, res) => {
  try {
    const idVal = req.params.id;
    const cols = await getAccColumns();
    if (cols.length === 0) return res.status(400).json({ ok: false, error: 'ACC table has no columns' });
    const pk = cols.find(c => /id$/i.test(c.name)) || cols[0];
    const q = `DELETE FROM dbo.ACC WHERE [${pk.name}] = @__id`;
    await db.query(q, { __id: normalizeValue(idVal, pk.data_type) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get top rows from a specific table: /table/:schema/:table
app.get('/table/:schema/:table', requireAuth, async (req, res) => {
  try {
    const schema = req.params.schema;
    const table = req.params.table;
    // Basic validation to avoid SQL injection via identifiers
    const validName = /^[A-Za-z0-9_]+$/;
    if (!validName.test(schema) || !validName.test(table)) {
      return res.status(400).json({ ok: false, error: 'Invalid schema or table name' });
    }
    const q = `SELECT TOP 50 * FROM [${schema}].[${table}]`;
    const result = await db.query(q);
    res.json({ ok: true, rows: result.recordset });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(port, () => console.log(`Server listening on ${port}`));
