const db = require('./db');
(async ()=>{
  try {
    const q = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='USER' ORDER BY ORDINAL_POSITION";
    const r = await db.query(q);
    console.log(JSON.stringify(r.recordset, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e.message||e);
    process.exit(2);
  }
})();
