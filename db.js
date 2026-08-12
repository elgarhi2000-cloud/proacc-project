const sql = require('mssql');

let pool;

const requiredEnv = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: (process.env.DB_ENCRYPT === 'true'),
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

if (process.env.DB_INSTANCE) {
  config.options.instanceName = process.env.DB_INSTANCE;
}

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(config);
  return pool;
}

async function query(q, params) {
  const p = await getPool();
  const request = p.request();
  if (params && typeof params === 'object') {
    for (const [name, val] of Object.entries(params)) {
      request.input(name, val);
    }
  }
  return request.query(q);
}

module.exports = { query, sql };
