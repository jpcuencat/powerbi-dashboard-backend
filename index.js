require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const winston = require('winston');

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
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

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

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('Power BI Embed Backend funcionando!');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

const db = require('./db');

app.get('/reportes', (req, res) => {
  logger.info('Solicitando lista de reportes', { ip: req.ip });
  
  db.all(`SELECT id, nombre FROM reportes_powerbi`, [], (err, rows) => {
    if (err) {
      logger.error('Error al obtener reportes', { error: err.message, ip: req.ip });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    
    logger.info('Reportes obtenidos exitosamente', { count: rows.length, ip: req.ip });
    res.json(rows);
  });
});


app.post('/embed-token', 
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
