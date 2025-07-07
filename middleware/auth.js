const jwt = require('jsonwebtoken');
const db = require('../db');

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // Verificar que el usuario siga existiendo y esté aprobado
    db.get('SELECT * FROM usuarios WHERE id = ? AND estado = "aprobado"', [decoded.id], (err, user) => {
      if (err) {
        console.error('Error verificando usuario:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Usuario no encontrado o no aprobado' });
      }
      
      // Actualizar último acceso
      db.run('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      
      req.user = user;
      next();
    });
  } catch (error) {
    res.status(400).json({ error: 'Token no válido' });
  }
};

// Middleware para verificar que el usuario esté aprobado
const requireApproved = (req, res, next) => {
  if (req.user && req.user.estado === 'aprobado') {
    return next();
  }
  res.status(403).json({ 
    error: 'Acceso denegado. Su cuenta está pendiente de aprobación por un administrador.' 
  });
};

// Middleware para verificar rol de administrador
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.rol === 'admin' && req.user.estado === 'aprobado') {
    return next();
  }
  res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
};

module.exports = {
  verifyToken,
  requireApproved,
  requireAdmin
};
