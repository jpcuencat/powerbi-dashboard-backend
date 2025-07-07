require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const winston = require('winston');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { verifyToken, requireApproved } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Configurar sesiones
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db' }),
  secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000 // 8 horas
  }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP, intente más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

const embedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // Aumentado para desarrollo
  message: 'Demasiadas solicitudes de tokens, intente más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Rutas de autenticación
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('Power BI Embed Backend funcionando!');
});

// Ruta de salud que no requiere autenticación
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

const db = require('./db');

// Obtener todos los reportes (protegido)
app.get('/reportes', verifyToken, requireApproved, (req, res) => {
  logger.info('Solicitando lista de reportes', { ip: req.ip });
  
  db.all(`SELECT id, nombre, workspace_id, report_id, pagina_default, estado, Descripcion, imagen_url FROM reportes_powerbi`, [], (err, rows) => {
    if (err) {
      logger.error('Error al obtener reportes', { error: err.message, ip: req.ip });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    
    logger.info('Reportes obtenidos exitosamente', { count: rows.length, ip: req.ip });
    res.json(rows);
  });
});

// Obtener un reporte específico por ID (protegido)
app.get('/reportes/:id', verifyToken, requireApproved, (req, res) => {
  const reporteId = req.params.id;
  
  // Validación básica del ID
  if (!reporteId || isNaN(reporteId) || parseInt(reporteId) <= 0) {
    logger.warn('ID de reporte inválido', { reporteId, ip: req.ip });
    return res.status(400).json({ error: 'ID de reporte debe ser un número entero positivo' });
  }
  
  logger.info('Solicitando reporte específico', { reporteId, ip: req.ip });
  
  db.get(`SELECT id, nombre, workspace_id, report_id, pagina_default, estado, Descripcion, imagen_url FROM reportes_powerbi WHERE id = ?`, [reporteId], (err, row) => {
    if (err) {
      logger.error('Error al obtener reporte', { error: err.message, reporteId, ip: req.ip });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    
    if (!row) {
      logger.warn('Reporte no encontrado', { reporteId, ip: req.ip });
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    
    logger.info('Reporte obtenido exitosamente', { reporteId, ip: req.ip });
    res.json(row);
  });
});

// Crear un nuevo reporte (solo administradores)
app.post('/reportes', verifyToken, requireApproved, [
  body('nombre').notEmpty().withMessage('Nombre es requerido'),
  body('workspace_id').notEmpty().withMessage('Workspace ID es requerido'),
  body('report_id').notEmpty().withMessage('Report ID es requerido'),
  body('pagina_default').optional().isString(),
  body('estado').optional().isString(),
  body('Descripcion').optional().isString(),
  body('imagen_url').optional().isURL().withMessage('URL de imagen debe ser válida')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validación fallida en crear reporte', { 
      errors: errors.array(), 
      ip: req.ip 
    });
    return res.status(400).json({ 
      error: 'Datos de entrada inválidos',
      details: errors.array()
    });
  }

  const { nombre, workspace_id, report_id, pagina_default, estado, Descripcion, imagen_url } = req.body;
  
  logger.info('Creando nuevo reporte', { nombre, ip: req.ip });
  
  db.run(
    `INSERT INTO reportes_powerbi (nombre, workspace_id, report_id, pagina_default, estado, Descripcion, imagen_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nombre, workspace_id, report_id, pagina_default, estado, Descripcion, imagen_url],
    function(err) {
      if (err) {
        logger.error('Error al crear reporte', { error: err.message, ip: req.ip });
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      logger.info('Reporte creado exitosamente', { id: this.lastID, nombre, ip: req.ip });
      res.status(201).json({ 
        id: this.lastID, 
        nombre, 
        workspace_id, 
        report_id, 
        pagina_default, 
        estado, 
        Descripcion, 
        imagen_url 
      });
    }
  );
});

// Actualizar un reporte existente (solo administradores)
app.put('/reportes/:id', verifyToken, requireApproved, [
  body('nombre').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
  body('workspace_id').optional().notEmpty().withMessage('Workspace ID no puede estar vacío'),
  body('report_id').optional().notEmpty().withMessage('Report ID no puede estar vacío'),
  body('pagina_default').optional().isString(),
  body('estado').optional().isString(),
  body('Descripcion').optional().isString(),
  body('imagen_url').optional().isURL().withMessage('URL de imagen debe ser válida')
], (req, res) => {
  const reporteId = req.params.id;
  
  // Validación básica del ID
  if (!reporteId || isNaN(reporteId) || parseInt(reporteId) <= 0) {
    logger.warn('ID de reporte inválido para actualizar', { reporteId, ip: req.ip });
    return res.status(400).json({ error: 'ID de reporte debe ser un número entero positivo' });
  }
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validación fallida en actualizar reporte', { 
      errors: errors.array(), 
      ip: req.ip 
    });
    return res.status(400).json({ 
      error: 'Datos de entrada inválidos',
      details: errors.array()
    });
  }

  const { nombre, workspace_id, report_id, pagina_default, estado, Descripcion, imagen_url } = req.body;
  
  logger.info('Actualizando reporte', { reporteId, ip: req.ip });
  
  // Primero verificar si el reporte existe
  db.get(`SELECT id FROM reportes_powerbi WHERE id = ?`, [reporteId], (err, row) => {
    if (err) {
      logger.error('Error al verificar reporte', { error: err.message, reporteId, ip: req.ip });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    
    if (!row) {
      logger.warn('Reporte no encontrado para actualizar', { reporteId, ip: req.ip });
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    
    // Construir la consulta de actualización dinámicamente
    const fields = [];
    const values = [];
    
    if (nombre !== undefined) { fields.push('nombre = ?'); values.push(nombre); }
    if (workspace_id !== undefined) { fields.push('workspace_id = ?'); values.push(workspace_id); }
    if (report_id !== undefined) { fields.push('report_id = ?'); values.push(report_id); }
    if (pagina_default !== undefined) { fields.push('pagina_default = ?'); values.push(pagina_default); }
    if (estado !== undefined) { fields.push('estado = ?'); values.push(estado); }
    if (Descripcion !== undefined) { fields.push('Descripcion = ?'); values.push(Descripcion); }
    if (imagen_url !== undefined) { fields.push('imagen_url = ?'); values.push(imagen_url); }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }
    
    values.push(reporteId);
    
    db.run(
      `UPDATE reportes_powerbi SET ${fields.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          logger.error('Error al actualizar reporte', { error: err.message, reporteId, ip: req.ip });
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
        
        logger.info('Reporte actualizado exitosamente', { reporteId, ip: req.ip });
        
        // Obtener el reporte actualizado
        db.get(`SELECT id, nombre, workspace_id, report_id, pagina_default, estado, Descripcion, imagen_url FROM reportes_powerbi WHERE id = ?`, [reporteId], (err, updatedRow) => {
          if (err) {
            logger.error('Error al obtener reporte actualizado', { error: err.message, reporteId, ip: req.ip });
            return res.status(500).json({ error: 'Error interno del servidor' });
          }
          
          res.json(updatedRow);
        });
      }
    );
  });
});

// Eliminar un reporte (solo administradores)
app.delete('/reportes/:id', verifyToken, requireApproved, (req, res) => {
  const reporteId = req.params.id;
  
  // Validación básica del ID
  if (!reporteId || isNaN(reporteId) || parseInt(reporteId) <= 0) {
    logger.warn('ID de reporte inválido para eliminar', { reporteId, ip: req.ip });
    return res.status(400).json({ error: 'ID de reporte debe ser un número entero positivo' });
  }
  
  logger.info('Eliminando reporte', { reporteId, ip: req.ip });
  
  // Primero verificar si el reporte existe
  db.get(`SELECT id FROM reportes_powerbi WHERE id = ?`, [reporteId], (err, row) => {
    if (err) {
      logger.error('Error al verificar reporte', { error: err.message, reporteId, ip: req.ip });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    
    if (!row) {
      logger.warn('Reporte no encontrado para eliminar', { reporteId, ip: req.ip });
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    
    db.run(`DELETE FROM reportes_powerbi WHERE id = ?`, [reporteId], function(err) {
      if (err) {
        logger.error('Error al eliminar reporte', { error: err.message, reporteId, ip: req.ip });
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      logger.info('Reporte eliminado exitosamente', { reporteId, ip: req.ip });
      res.json({ message: 'Reporte eliminado exitosamente' });
    });
  });
});


app.post('/embed-token', 
  verifyToken,
  requireApproved,
  // embedLimiter, // Deshabilitado temporalmente para desarrollo
  [
    body('reportId')
      .isInt({ min: 1 })
      .withMessage('reportId debe ser un número entero positivo')
      .toInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validación fallida en embed-token', { 
        errors: errors.array(), 
        ip: req.ip 
      });
      return res.status(400).json({ 
        error: 'Datos de entrada inválidos',
        details: errors.array()
      });
    }

    const reportDbId = req.body.reportId;
    
    logger.info('Solicitando token de embedding', { 
      reportDbId, 
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // 1. Obtener datos del reporte desde la base
    db.get(`SELECT * FROM reportes_powerbi WHERE id = ?`, [reportDbId], async (err, reporte) => {
      if (err) {
        logger.error('Error de base de datos', { error: err.message, reportDbId, ip: req.ip });
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      
      if (!reporte) {
        logger.warn('Reporte no encontrado', { reportDbId, ip: req.ip });
        return res.status(404).json({ error: 'Reporte no encontrado' });
      }

      const { report_id, workspace_id } = reporte;

      // Validar que los IDs no estén vacíos
      if (!report_id || !workspace_id) {
        logger.error('Reporte con datos incompletos', { reportDbId, ip: req.ip });
        return res.status(500).json({ error: 'Configuración de reporte incompleta' });
      }

      // Validar variables de entorno
      const requiredEnvVars = ['TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET', 'POWER_BI_USERNAME', 'POWER_BI_PASSWORD'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        logger.error('Variables de entorno faltantes', { missingVars });
        return res.status(500).json({ error: 'Configuración del servidor incompleta' });
      }

      try {
        // 2. Obtener Access Token para Power BI API
        logger.info('Obteniendo access token de PowerBI', { reportDbId, ip: req.ip });
        
        const tokenResponse = await axios.post(
          `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/token`,
          new URLSearchParams({
            grant_type: 'password',
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            username: process.env.POWER_BI_USERNAME,
            password: process.env.POWER_BI_PASSWORD,
            resource: 'https://analysis.windows.net/powerbi/api'
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
          }
        );

        const accessToken = tokenResponse.data.access_token;
        
        if (!accessToken) {
          logger.error('Token de acceso no recibido', { reportDbId, ip: req.ip });
          return res.status(500).json({ error: 'Error en autenticación' });
        }


        // 3. Llamar a la API de Power BI para obtener el Embed Token
        logger.info('Generando embed token', { reportDbId, report_id, workspace_id, ip: req.ip });
        
        const embedResponse = await axios.post(
          `https://api.powerbi.com/v1.0/myorg/groups/${workspace_id}/reports/${report_id}/GenerateToken`,
          {
            accessLevel: 'View',
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000
          }
        );

        const embedToken = embedResponse.data.token;
        
        if (!embedToken) {
          logger.error('Embed token no recibido', { reportDbId, ip: req.ip });
          return res.status(500).json({ error: 'Error al generar token de embedding' });
        }

        logger.info('Token de embedding generado exitosamente', { reportDbId, ip: req.ip });
        
        res.json({
          embedToken,
          embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${report_id}&groupId=${workspace_id}`,
          reportId: report_id,
          workspaceId: workspace_id,
          nombre: reporte.nombre,
          paginaDefault: reporte.pagina_default,
          estado: reporte.estado,
          descripcion: reporte.Descripcion,
          imagenUrl: reporte.imagen_url
        });
        
      } catch (error) {
        logger.error('Error al generar token de Power BI', {
          error: error.message,
          reportDbId,
          ip: req.ip,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        
        if (error.response?.status === 401) {
          return res.status(401).json({ error: 'Error de autenticación con Power BI' });
        }
        
        if (error.response?.status === 403) {
          return res.status(403).json({ error: 'Sin permisos para acceder al reporte' });
        }
        
        if (error.response?.status === 404) {
          return res.status(404).json({ error: 'Reporte no encontrado en Power BI' });
        }
        
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    });
  }
);
