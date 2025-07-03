# 🔐 Guía de Seguridad - Power BI Backend

## 🚨 **DATOS SENSIBLES IDENTIFICADOS**

Este proyecto maneja credenciales extremadamente sensibles:

### Credenciales de Azure AD
- **TENANT_ID**: Identificador del tenant de Azure
- **CLIENT_ID**: ID de la aplicación registrada
- **CLIENT_SECRET**: ⚠️ **CRÍTICO** - Secreto de aplicación

### Credenciales de Power BI
- **POWER_BI_USERNAME**: Email/usuario de Power BI
- **POWER_BI_PASSWORD**: ⚠️ **CRÍTICO** - Contraseña en texto plano

## 🛡️ **MEDIDAS DE PROTECCIÓN IMPLEMENTADAS**

### 1. Control de Archivos Sensibles
```bash
# .gitignore configurado para excluir:
.env                    # Archivo con credenciales
.env.local             # Variantes locales
*.db                   # Base de datos SQLite
*.log                  # Archivos de log
```

### 2. Archivo de Plantilla
- `.env.example`: Plantilla segura sin credenciales reales
- Incluye todas las variables necesarias
- Contiene advertencias de seguridad

### 3. Validación de Configuración
- Verificación de variables de entorno al iniciar
- Logs de errores sin exponer credenciales
- Timeouts para prevenir ataques de timing

## ⚠️ **RIESGOS CRÍTICOS IDENTIFICADOS**

### 1. Credenciales en Texto Plano
```bash
# PROBLEMA: Contraseñas almacenadas sin cifrar
POWER_BI_PASSWORD=contraseña-real
CLIENT_SECRET=secreto-real

# SOLUCIÓN: Usar servicios de gestión de secretos
```

### 2. Flujo de Autenticación ROPC
```javascript
// PROBLEMA: Resource Owner Password Credentials Flow
grant_type: 'password'  // Deprecated y menos seguro

// SOLUCIÓN: Migrar a Client Credentials Flow
grant_type: 'client_credentials'
```

## 🔧 **RECOMENDACIONES INMEDIATAS**

### 1. Antes de Subir a Git
```bash
# Verificar que .env NO esté en Git
git status
git ls-files | grep -E "\\.env$"

# Si .env está rastreado, removerlo:
git rm --cached .env
git commit -m "Remove .env from git tracking"
```

### 2. Configuración Segura
```bash
# Crear .env desde plantilla
cp .env.example .env

# Configurar permisos restrictivos
chmod 600 .env  # Solo lectura/escritura para propietario

# Verificar que .gitignore funcione
git check-ignore .env  # Debe retornar .env
```

### 3. Rotación de Credenciales
```bash
# Cambiar credenciales si han sido expuestas
# 1. Generar nuevo CLIENT_SECRET en Azure AD
# 2. Cambiar contraseña de Power BI
# 3. Actualizar .env con nuevas credenciales
```

## 🏗️ **MEJORAS RECOMENDADAS**

### 1. Gestión de Secretos
```javascript
// Opción 1: Azure Key Vault
const { SecretClient } = require("@azure/keyvault-secrets");

// Opción 2: HashiCorp Vault
const vault = require("node-vault");

// Opción 3: Variables de entorno del sistema
const secret = process.env.POWER_BI_PASSWORD;
```

### 2. Autenticación Mejorada
```javascript
// Migrar a Service Principal (Client Credentials)
const tokenResponse = await axios.post(
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://analysis.windows.net/powerbi/api/.default'
  }
);
```

### 3. Cifrado de Datos
```javascript
// Cifrar credenciales sensibles
const crypto = require('crypto');

function encryptCredential(text, key) {
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}
```

## 🔍 **MONITOREO Y ALERTAS**

### 1. Logs de Seguridad
```javascript
// Logs sin credenciales
logger.info('Authentication attempt', {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  // NO incluir credenciales en logs
});
```

### 2. Detección de Anomalías
```javascript
// Alertas por patrones sospechosos
- Múltiples intentos fallidos
- Acceso desde IPs inusuales
- Horarios fuera de lo normal
```

## 📋 **CHECKLIST DE SEGURIDAD**

### Antes de Deployment
- [ ] `.env` NO está en Git
- [ ] `.gitignore` configurado correctamente
- [ ] Credenciales diferentes para dev/prod
- [ ] Permisos de archivo restrictivos
- [ ] Logs no exponen credenciales
- [ ] Rate limiting implementado
- [ ] Headers de seguridad configurados

### En Producción
- [ ] HTTPS obligatorio
- [ ] Credenciales en servicio de gestión
- [ ] Monitoreo de logs activo
- [ ] Backups de configuración
- [ ] Plan de rotación de credenciales
- [ ] Firewall y control de acceso

## 🆘 **EN CASO DE COMPROMISO**

### Acción Inmediata
1. **Rotar todas las credenciales**
2. **Revisar logs de acceso**
3. **Cambiar secrets en Azure AD**
4. **Actualizar contraseñas**
5. **Notificar al equipo de seguridad**

### Investigación
```bash
# Revisar historial de Git
git log --oneline --grep="env"
git log --oneline --grep="password"
git log --oneline --grep="secret"

# Verificar archivos comprometidos
git log --follow .env
```

## 📞 **CONTACTO**

Para reportar vulnerabilidades o problemas de seguridad:
- Email: security@tu-organizacion.com
- Crear issue privado en GitHub
- Contactar al administrador del sistema

---

> ⚠️ **RECORDATORIO**: Este archivo contiene información sensible sobre la arquitectura de seguridad. Manténlo actualizado y seguro.
