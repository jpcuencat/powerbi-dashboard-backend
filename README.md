# PowerBI Backend - Guía de Seguridad

## Mejoras de Seguridad Implementadas

### 1. Rate Limiting
- **Límite general**: 100 requests por 15 minutos por IP
- **Límite para tokens**: 10 requests por 15 minutos por IP
- Protege contra ataques de fuerza bruta y abuso de API

### 2. Validación de Entrada
- Validación estricta de `reportId` (debe ser entero positivo)
- Sanitización automática de datos de entrada
- Mensajes de error detallados para desarrollo

### 3. Logging de Seguridad
- Logs estructurados en formato JSON
- Registro de IPs, User-Agents y acciones sensibles
- Separación de logs por nivel (error.log, combined.log)

### 4. Headers de Seguridad
- **Helmet** implementado para headers de seguridad
- Protección contra XSS, clickjacking, etc.

### 5. CORS Configurado
- Orígenes permitidos configurables via `.env`
- Credentials habilitados de forma controlada

### 6. Manejo de Errores
- No exposición de información sensible en errores
- Logging detallado para debugging interno
- Códigos HTTP específicos para cada tipo de error

### 7. Validación de Configuración
- Verificación de variables de entorno requeridas
- Validación de datos de reporte antes de procesamiento
- Timeouts configurados para requests externos

## Configuración

1. **Instalar dependencias**:
```bash
npm install
```

2. **Configurar variables de entorno**:
```bash
cp .env.example .env
# Editar .env con los valores correctos
```

3. **Variables de entorno requeridas**:
- `TENANT_ID`: ID del tenant de Azure AD
- `CLIENT_ID`: ID de la aplicación registrada
- `CLIENT_SECRET`: Secret de la aplicación
- `POWER_BI_USERNAME`: Usuario de Power BI
- `POWER_BI_PASSWORD`: Contraseña del usuario
- `ALLOWED_ORIGINS`: Orígenes permitidos para CORS

## Recomendaciones Adicionales

### Seguridad de Producción
1. **Cambiar flujo de autenticación**: Migrar de ROPC a Client Credentials Flow
2. **Usar Azure Key Vault**: Para manejo seguro de secretos
3. **Implementar HTTPS**: Certificados SSL/TLS obligatorios
4. **Monitoreo**: Implementar alertas para patrones sospechosos

### Monitoreo de Logs
- Revisar `error.log` para errores críticos
- Monitorear `combined.log` para patrones de uso
- Configurar rotación de logs en producción

### Base de Datos
- Considerar migrar a PostgreSQL/MySQL para producción
- Implementar backups automáticos
- Cifrado de datos sensibles

## Endpoints

### GET /reportes
- **Rate Limit**: 100 req/15min
- **Logs**: IP, cantidad de reportes devueltos

### POST /embed-token
- **Rate Limit**: 10 req/15min
- **Validación**: reportId debe ser entero positivo
- **Logs**: IP, User-Agent, reportId, errores detallados

## Estructura de Logs

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Token de embedding generado exitosamente",
  "reportDbId": 1,
  "ip": "127.0.0.1"
}
```