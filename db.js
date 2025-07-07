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
      pagina_default TEXT,
      estado TEXT,
      Descripcion TEXT,
      imagen_url TEXT
    );
  `);
  
  // Agregar los nuevos campos si la tabla ya existe
  db.run(`ALTER TABLE reportes_powerbi ADD COLUMN estado TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error agregando columna estado:', err.message);
    }
  });
  
  db.run(`ALTER TABLE reportes_powerbi ADD COLUMN Descripcion TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error agregando columna Descripcion:', err.message);
    }
  });
  
  db.run(`ALTER TABLE reportes_powerbi ADD COLUMN imagen_url TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error agregando columna imagen_url:', err.message);
    }
  });
  
  // Crear tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      microsoft_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      apellidos TEXT,
      foto_url TEXT,
      estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'aprobado', 'rechazado')),
      rol TEXT DEFAULT 'usuario' CHECK(rol IN ('usuario', 'admin')),
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_aprobacion DATETIME,
      aprobado_por INTEGER,
      ultimo_acceso DATETIME,
      FOREIGN KEY (aprobado_por) REFERENCES usuarios(id)
    );
  `);
  
  // Crear tabla de sesiones
  db.run(`
    CREATE TABLE IF NOT EXISTS sesiones (
      id TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      expires INTEGER,
      data TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);
  
  // Crear índices para optimizar consultas
  db.run(`CREATE INDEX IF NOT EXISTS idx_usuarios_microsoft_id ON usuarios(microsoft_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado);`);
});

module.exports = db;
