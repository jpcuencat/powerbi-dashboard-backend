const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Ruta de prueba para verificar configuración
router.get('/test', (req, res) => {
  res.json({
    message: 'Rutas de autenticación funcionando',
    config: {
      tenantId: process.env.TENANT_ID ? 'configurado' : 'falta',
      clientId: process.env.CLIENT_ID ? 'configurado' : 'falta',
      callbackUrl: process.env.CALLBACK_URL,
      frontendUrl: process.env.FRONTEND_URL
    }
  });
});

// Ruta de login temporal para debug
router.get('/login/debug', (req, res) => {
  console.log('=== INICIANDO LOGIN DEBUG ===');
  const debugCallbackUrl = 'http://localhost:3001/auth/callback/debug';
  
  const authUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/authorize?` +
    `client_id=${process.env.CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(debugCallbackUrl)}&` +
    `scope=${encodeURIComponent('openid profile email User.Read')}&` +
    `response_mode=query`;
  
  console.log('URL de autorización DEBUG:', authUrl);
  res.redirect(authUrl);
});

// Ruta para iniciar el proceso de autenticación con Microsoft
router.get('/login/microsoft', (req, res) => {
  console.log('=== INICIANDO LOGIN CON MICROSOFT ===');
  console.log('TENANT_ID:', process.env.TENANT_ID);
  console.log('CLIENT_ID:', process.env.CLIENT_ID);
  console.log('CALLBACK_URL:', process.env.CALLBACK_URL);
  
  const authUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/authorize?` +
    `client_id=${process.env.CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(process.env.CALLBACK_URL)}&` +
    `scope=${encodeURIComponent('openid profile email User.Read')}&` +
    `response_mode=query`;
  
  console.log('URL de autorización generada:', authUrl);
  res.redirect(authUrl);
});

// Página de debug para el callback
router.get('/callback/debug', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Debug OAuth Callback</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .info { background: #e8f4f8; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .error { background: #ffe6e6; padding: 15px; margin: 10px 0; border-radius: 5px; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>OAuth Callback Debug</h1>
      <div class="info">
        <h3>Query Parameters:</h3>
        <pre>${JSON.stringify(req.query, null, 2)}</pre>
      </div>
      <div class="info">
        <h3>URL Completa:</h3>
        <pre>${req.url}</pre>
      </div>
      <div class="info">
        <h3>Headers Relevantes:</h3>
        <pre>Host: ${req.headers.host}
User-Agent: ${req.headers['user-agent']}
Referer: ${req.headers.referer || 'No referer'}</pre>
      </div>
      <script>
        console.log('Query parameters:', ${JSON.stringify(req.query)});
        console.log('URL:', '${req.url}');
      </script>
    </body>
    </html>
  `);
});

// Callback de Microsoft OAuth
router.get('/callback/microsoft', async (req, res) => {
  console.log('=== CALLBACK DE MICROSOFT ===');
  console.log('Query parameters:', req.query);
  console.log('Headers:', req.headers);
  console.log('URL completa:', req.url);
  
  const { code, error, error_description } = req.query;
  
  if (error) {
    console.error('Error de Microsoft OAuth:', error, error_description);
    return res.status(400).json({ 
      error: 'Error de Microsoft OAuth', 
      details: error_description || error 
    });
  }
  
  if (!code) {
    console.error('No se recibió código de autorización');
    return res.status(400).json({ error: 'Código de autorización no proporcionado' });
  }
  
  console.log('Código de autorización recibido:', code);

  try {
    // Intercambiar código por tokens
    const axios = require('axios');
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
        redirect_uri: process.env.CALLBACK_URL,
        grant_type: 'authorization_code',
        scope: 'openid profile email User.Read'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token } = tokenResponse.data;

    // Obtener información del usuario
    const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const userInfo = userResponse.data;

    // Verificar o crear usuario en la base de datos
    // Primero buscar por microsoft_id, luego por email
    db.get('SELECT * FROM usuarios WHERE microsoft_id = ? OR email = ?', [userInfo.id, userInfo.mail || userInfo.userPrincipalName], (err, user) => {
      if (err) {
        console.error('Error verificando usuario:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      if (!user) {
        // Crear nuevo usuario pendiente de aprobación
        db.run(
          'INSERT INTO usuarios (microsoft_id, email, nombre, apellidos, foto_url, estado) VALUES (?, ?, ?, ?, ?, "pendiente")',
          [userInfo.id, userInfo.mail || userInfo.userPrincipalName, userInfo.givenName, userInfo.surname, userInfo.photo],
          function(err) {
            if (err) {
              console.error('Error creando usuario:', err);
              return res.status(500).json({ error: 'Error interno del servidor' });
            }

            // Redirigir a página de espera de aprobación
            return res.redirect(`http://localhost:3000/pending-approval`);
          }
        );
      } else {
        // Si el usuario existe pero no tiene microsoft_id, actualizarlo
        if (!user.microsoft_id) {
          db.run('UPDATE usuarios SET microsoft_id = ? WHERE id = ?', [userInfo.id, user.id], (updateErr) => {
            if (updateErr) {
              console.error('Error actualizando microsoft_id:', updateErr);
            }
          });
        }
        
        // Procesar según el estado del usuario
        if (user.estado === 'pendiente') {
          return res.redirect(`http://localhost:3000/pending-approval`);
        } else if (user.estado === 'rechazado') {
          return res.redirect(`http://localhost:3000/access-denied`);
        } else if (user.estado === 'aprobado') {
          // Generar JWT
          const token = jwt.sign(
            { id: user.id, email: user.email, estado: user.estado, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
          );

          // Actualizar último acceso
          db.run('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

          // Redirigir al frontend con el token
return res.redirect(`http://localhost:3000/auth-success?token=${token}`);
        }
      }
    });

  } catch (error) {
    console.error('Error en callback de Microsoft:', error);
    res.status(500).json({ error: 'Error en autenticación' });
  }
});

// Ruta para verificar el estado del usuario
router.get('/me', verifyToken, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    nombre: req.user.nombre,
    apellidos: req.user.apellidos,
    foto_url: req.user.foto_url,
    estado: req.user.estado,
    rol: req.user.rol,
    ultimo_acceso: req.user.ultimo_acceso
  });
});

// Ruta para logout
router.post('/logout', verifyToken, (req, res) => {
  // En una implementación más completa, podrías invalidar el token
  res.json({ message: 'Logout exitoso' });
});

// Rutas de administración
router.get('/admin/users', verifyToken, requireAdmin, (req, res) => {
  db.all('SELECT id, email, nombre, apellidos, estado, rol, fecha_registro, ultimo_acceso FROM usuarios ORDER BY fecha_registro DESC', [], (err, users) => {
    if (err) {
      console.error('Error obteniendo usuarios:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    res.json(users);
  });
});

// Aprobar usuario
router.put('/admin/users/:id/approve', verifyToken, requireAdmin, (req, res) => {
  const userId = req.params.id;
  
  db.run(
    'UPDATE usuarios SET estado = "aprobado", fecha_aprobacion = CURRENT_TIMESTAMP, aprobado_por = ? WHERE id = ?',
    [req.user.id, userId],
    function(err) {
      if (err) {
        console.error('Error aprobando usuario:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.json({ message: 'Usuario aprobado exitosamente' });
    }
  );
});

// Rechazar usuario
router.put('/admin/users/:id/reject', verifyToken, requireAdmin, (req, res) => {
  const userId = req.params.id;
  
  db.run(
    'UPDATE usuarios SET estado = "rechazado", aprobado_por = ? WHERE id = ?',
    [req.user.id, userId],
    function(err) {
      if (err) {
        console.error('Error rechazando usuario:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.json({ message: 'Usuario rechazado exitosamente' });
    }
  );
});

// Cambiar rol de usuario
router.put('/admin/users/:id/role', verifyToken, requireAdmin, (req, res) => {
  const userId = req.params.id;
  const { rol } = req.body;
  
  if (!['usuario', 'admin'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  
  db.run(
    'UPDATE usuarios SET rol = ? WHERE id = ?',
    [rol, userId],
    function(err) {
      if (err) {
        console.error('Error cambiando rol:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      res.json({ message: 'Rol actualizado exitosamente' });
    }
  );
});

module.exports = router;
