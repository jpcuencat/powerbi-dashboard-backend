const db = require('../db');

// Script para crear un usuario administrador inicial
// Ejecutar: node scripts/create-admin.js

const createInitialAdmin = () => {
  console.log('Creando usuario administrador inicial...');
  
  // Datos del administrador inicial (debes cambiar estos valores)
  const adminData = {
    microsoft_id: '7ef32de5-906b-4cc3-9292-fb130a69fdec', // Cambiar por un ID real de Microsoft
    email: 'jdatosanalitica@ucacue.edu.ec', // Cambiar por email real del administrador
    nombre: 'Jefatura',
    apellidos: 'Datos y Analitica',
    estado: 'aprobado',
    rol: 'admin'
  };
  
  // Verificar si ya existe un administrador
  db.get('SELECT id FROM usuarios WHERE rol = "admin" AND estado = "aprobado"', [], (err, existingAdmin) => {
    if (err) {
      console.error('Error verificando administradores existentes:', err);
      return;
    }
    
    if (existingAdmin) {
      console.log('Ya existe un administrador en el sistema.');
      console.log('Si necesitas crear otro, modifica este script o hazlo desde la interfaz de administración.');
      return;
    }
    
    // Crear el administrador inicial
    db.run(
      `INSERT INTO usuarios (microsoft_id, email, nombre, apellidos, estado, rol, fecha_registro, fecha_aprobacion) 
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [adminData.microsoft_id, adminData.email, adminData.nombre, adminData.apellidos, adminData.estado, adminData.rol],
      function(err) {
        if (err) {
          console.error('Error creando administrador inicial:', err);
          return;
        }
        
        console.log('✅ Administrador inicial creado exitosamente!');
        console.log('ID:', this.lastID);
        console.log('Email:', adminData.email);
        console.log('');
        console.log('⚠️  IMPORTANTE:');
        console.log('1. Cambia el microsoft_id por el ID real del usuario de Microsoft');
        console.log('2. Cambia el email por el email real del administrador');
        console.log('3. El administrador podrá aprobar otros usuarios desde la interfaz web');
        console.log('');
        console.log('Para hacer login como administrador:');
        console.log('1. Ve a http://localhost:3001/auth/login/microsoft');
        console.log('2. Inicia sesión con la cuenta de Microsoft configurada');
        console.log('3. Si el microsoft_id coincide, tendrás acceso como administrador');
        
        process.exit(0);
      }
    );
  });
};

// Función para listar todos los usuarios
const listUsers = () => {
  console.log('Usuarios en el sistema:');
  console.log('======================');
  
  db.all('SELECT id, email, nombre, apellidos, estado, rol, fecha_registro FROM usuarios ORDER BY fecha_registro DESC', [], (err, users) => {
    if (err) {
      console.error('Error obteniendo usuarios:', err);
      return;
    }
    
    if (users.length === 0) {
      console.log('No hay usuarios registrados en el sistema.');
    } else {
      users.forEach(user => {
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Nombre: ${user.nombre} ${user.apellidos || ''}`);
        console.log(`Estado: ${user.estado}`);
        console.log(`Rol: ${user.rol}`);
        console.log(`Registrado: ${user.fecha_registro}`);
        console.log('---');
      });
    }
    process.exit(0);
  });
};

// Procesar argumentos de línea de comandos
const command = process.argv[2];

switch(command) {
  case 'create':
    createInitialAdmin();
    break;
  case 'list':
    listUsers();
    break;
  default:
    console.log('Uso:');
    console.log('  node scripts/create-admin.js create  - Crear administrador inicial');
    console.log('  node scripts/create-admin.js list    - Listar todos los usuarios');
    process.exit(1);
}
