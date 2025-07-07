const passport = require('passport');
const MicrosoftStrategy = require('passport-azure-ad-oauth2').Strategy;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
const dotenv = require('dotenv');
dotenv.config();

// Configuración del JWT
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET no está definido en las variables de entorno.');
}

// Estrategia de autenticación de Microsoft
passport.use(new MicrosoftStrategy(
  {
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['user.read']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Verificar o registrar al usuario
      db.get('SELECT * FROM usuarios WHERE microsoft_id = ?', [profile.oid], (err, user) => {
        if (err) return done(err);
        if (!user) {
          // Crear nuevo usuario pendiente de aprobación
          db.run('INSERT INTO usuarios (microsoft_id, email, nombre, estado) VALUES (?, ?, ?, "pendiente")',
            [profile.oid, profile._json.email, profile.displayName],
            function (err) {
              if (err) return done(err);
              return done(null, { id: this.lastID, ...profile });
            });
        } else {
          return done(null, user);
        }
      });
    } catch (err) {
      done(err);
    }
  }
));

// Serializar el usuario
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserializar el usuario
passport.deserializeUser((id, done) => {
  db.get('SELECT * FROM usuarios WHERE id = ?', [id], (err, user) => {
    if (err) return done(err);
    done(null, user);
  });
});

// Middleware para verificar si el usuario está autenticado
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

// Generar JWT
const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email, estado: user.estado, rol: user.rol }, jwtSecret, { expiresIn: '1h' });
};

// Middleware para verificar el rol de administrador
const ensureAdmin = (req, res, next) => {
  if (req.user && req.user.rol === 'admin') {
    return next();
  }
  res.status(403).send('Acceso denegado');
};

module.exports = {
  passport,
  ensureAuthenticated,
  generateToken,
  ensureAdmin
};

