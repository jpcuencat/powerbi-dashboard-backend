# API Documentation - Power BI Backend

## Estructura de la Base de Datos

La tabla `reportes_powerbi` ahora incluye los siguientes campos:

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `nombre` (TEXT)
- `workspace_id` (TEXT)
- `report_id` (TEXT)
- `pagina_default` (TEXT)
- `estado` (TEXT) - **NUEVO CAMPO**
- `Descripcion` (TEXT) - **NUEVO CAMPO**
- `imagen_url` (TEXT) - **NUEVO CAMPO**

## Endpoints Disponibles

### 1. Obtener todos los reportes
**GET** `/reportes`

Retorna una lista con todos los reportes y todos sus campos.

**Respuesta:**
```json
[
  {
    "id": 1,
    "nombre": "Reporte de Ventas",
    "workspace_id": "abc123",
    "report_id": "def456",
    "pagina_default": "page1",
    "estado": "activo",
    "Descripcion": "Reporte mensual de ventas",
    "imagen_url": "https://example.com/imagen.jpg"
  }
]
```

### 2. Obtener un reporte específico
**GET** `/reportes/:id`

Retorna la información completa de un reporte específico.

**Parámetros:**
- `id`: ID numérico del reporte

**Respuesta:**
```json
{
  "id": 1,
  "nombre": "Reporte de Ventas",
  "workspace_id": "abc123",
  "report_id": "def456",
  "pagina_default": "page1",
  "estado": "activo",
  "Descripcion": "Reporte mensual de ventas",
  "imagen_url": "https://example.com/imagen.jpg"
}
```

### 3. Crear un nuevo reporte
**POST** `/reportes`

Crea un nuevo reporte en la base de datos.

**Body (JSON):**
```json
{
  "nombre": "Nuevo Reporte", // REQUERIDO
  "workspace_id": "abc123", // REQUERIDO
  "report_id": "def456", // REQUERIDO
  "pagina_default": "page1", // OPCIONAL
  "estado": "activo", // OPCIONAL
  "Descripcion": "Descripción del reporte", // OPCIONAL
  "imagen_url": "https://example.com/imagen.jpg" // OPCIONAL
}
```

**Respuesta:**
```json
{
  "id": 2,
  "nombre": "Nuevo Reporte",
  "workspace_id": "abc123",
  "report_id": "def456",
  "pagina_default": "page1",
  "estado": "activo",
  "Descripcion": "Descripción del reporte",
  "imagen_url": "https://example.com/imagen.jpg"
}
```

### 4. Actualizar un reporte existente
**PUT** `/reportes/:id`

Actualiza los campos especificados de un reporte existente.

**Parámetros:**
- `id`: ID numérico del reporte

**Body (JSON):**
```json
{
  "nombre": "Reporte Actualizado", // OPCIONAL
  "workspace_id": "xyz789", // OPCIONAL
  "report_id": "ghi012", // OPCIONAL
  "pagina_default": "page2", // OPCIONAL
  "estado": "inactivo", // OPCIONAL
  "Descripcion": "Nueva descripción", // OPCIONAL
  "imagen_url": "https://example.com/nueva-imagen.jpg" // OPCIONAL
}
```

**Respuesta:**
```json
{
  "id": 1,
  "nombre": "Reporte Actualizado",
  "workspace_id": "xyz789",
  "report_id": "ghi012",
  "pagina_default": "page2",
  "estado": "inactivo",
  "Descripcion": "Nueva descripción",
  "imagen_url": "https://example.com/nueva-imagen.jpg"
}
```

### 5. Eliminar un reporte
**DELETE** `/reportes/:id`

Elimina un reporte de la base de datos.

**Parámetros:**
- `id`: ID numérico del reporte

**Respuesta:**
```json
{
  "message": "Reporte eliminado exitosamente"
}
```

### 6. Generar token de embedding
**POST** `/embed-token`

Genera un token para embedding de Power BI. **Ahora incluye información adicional del reporte.**

**Body (JSON):**
```json
{
  "reportId": 1
}
```

**Respuesta:**
```json
{
  "embedToken": "H4sIAA...",
  "embedUrl": "https://app.powerbi.com/reportEmbed?reportId=def456&groupId=abc123",
  "reportId": "def456",
  "workspaceId": "abc123",
  "nombre": "Reporte de Ventas",
  "paginaDefault": "page1",
  "estado": "activo",
  "descripcion": "Reporte mensual de ventas",
  "imagenUrl": "https://example.com/imagen.jpg"
}
```

## Validaciones

### Campos requeridos para crear un reporte:
- `nombre`: No puede estar vacío
- `workspace_id`: No puede estar vacío
- `report_id`: No puede estar vacío

### Validaciones especiales:
- `imagen_url`: Debe ser una URL válida si se proporciona
- Todos los campos opcionales pueden ser `null` o no incluirse en la petición

## Manejo de Errores

### Códigos de error comunes:
- `400`: Datos de entrada inválidos o ID inválido
- `404`: Reporte no encontrado
- `500`: Error interno del servidor

### Ejemplo de respuesta de error:
```json
{
  "error": "Datos de entrada inválidos",
  "details": [
    {
      "type": "field",
      "value": "",
      "msg": "Nombre es requerido",
      "path": "nombre",
      "location": "body"
    }
  ]
}
```

## Migración de Base de Datos

El sistema automáticamente:
1. Crea la tabla con la nueva estructura si no existe
2. Agrega las nuevas columnas (`estado`, `Descripcion`, `imagen_url`) si la tabla ya existe
3. Maneja los errores de columnas duplicadas silenciosamente

No es necesario realizar ninguna migración manual.
