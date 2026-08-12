const db = require('./db');
(async ()=>{
  const username = process.env.TEST_USER;
  const password = process.env.TEST_PASS;

  if (!username || !password) {
    throw new Error('Set TEST_USER and TEST_PASS in your environment before running this script.');
  }

  try {
    console.log('Inserting test user', username);
    const q = "INSERT INTO dbo.[USER] (UserName, UserPass) VALUES (@username, @password); SELECT SCOPE_IDENTITY() AS id;";
    const r = await db.query(q, { username, password });
    console.log('Insert result:', r.recordset);
    const users = await db.query('SELECT TOP 5 UserID, UserName FROM dbo.[USER] ORDER BY UserID DESC');
    console.log('Recent users:', users.recordset);
    process.exit(0);
  } catch (e) {
    console.error('Failed to insert user:', e.message || e);
    process.exit(2);
  }
})();
