const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./powerbi.db');

// Crea la tabla si no existe
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS reportes_powerbi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      workspace_id TEXT,
      report_id TEXT,
      pagina_default TEXT
    );
  `);
});

module.exports = db;
