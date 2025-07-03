#!/usr/bin/env node

/**
 * Script de Verificación de Seguridad
 * Valida que la configuración de seguridad esté correcta
 */

const fs = require('fs');
const path = require('path');

class SecurityChecker {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.passed = [];
    }

    // Colores para output
    colors = {
        red: '\x1b[31m',
        yellow: '\x1b[33m',
        green: '\x1b[32m',
        blue: '\x1b[34m',
        reset: '\x1b[0m'
    };

    log(message, type = 'info') {
        const color = this.colors[type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'green'];
        console.log(`${color}${message}${this.colors.reset}`);
    }

    checkFileExists(filePath, critical = false) {
        const exists = fs.existsSync(filePath);
        const message = `${filePath} ${exists ? 'existe' : 'NO existe'}`;
        
        if (!exists && critical) {
            this.errors.push(message);
            this.log(`❌ ${message}`, 'error');
        } else if (!exists) {
            this.warnings.push(message);
            this.log(`⚠️ ${message}`, 'warning');
        } else {
            this.passed.push(message);
            this.log(`✅ ${message}`, 'green');
        }
        
        return exists;
    }

    checkGitignore() {
        this.log('\n🔍 Verificando .gitignore...', 'blue');
        
        if (!this.checkFileExists('.gitignore', true)) {
            return false;
        }

        const content = fs.readFileSync('.gitignore', 'utf8');
        const requiredPatterns = ['.env', '*.log', '*.db', 'node_modules/'];
        
        for (const pattern of requiredPatterns) {
            if (content.includes(pattern)) {
                this.passed.push(`Patrón ${pattern} encontrado en .gitignore`);
                this.log(`✅ ${pattern} excluido correctamente`, 'green');
            } else {
                this.errors.push(`Patrón ${pattern} falta en .gitignore`);
                this.log(`❌ ${pattern} NO está en .gitignore`, 'error');
            }
        }
        
        return true;
    }

    checkEnvFiles() {
        this.log('\n🔍 Verificando archivos de entorno...', 'blue');
        
        // .env.example debe existir
        this.checkFileExists('.env.example', true);
        
        // .env debe existir para desarrollo
        const envExists = this.checkFileExists('.env');
        
        if (envExists) {
            this.checkEnvVariables();
        }
    }

    checkEnvVariables() {
        this.log('\n🔍 Verificando variables de entorno...', 'blue');
        
        const requiredVars = [
            'TENANT_ID',
            'CLIENT_ID', 
            'CLIENT_SECRET',
            'POWER_BI_USERNAME',
            'POWER_BI_PASSWORD'
        ];

        // Cargar variables sin usar dotenv para evitar dependencia
        const envContent = fs.readFileSync('.env', 'utf8');
        
        for (const varName of requiredVars) {
            const pattern = new RegExp(`^${varName}=.+$`, 'm');
            const hasVar = pattern.test(envContent);
            
            if (hasVar) {
                // Verificar que no tenga valores de ejemplo
                const examplePatterns = [
                    'your-tenant-id',
                    'your-client-id',
                    'your-client-secret',
                    'your-powerbi-username',
                    'your-powerbi-password'
                ];
                
                const line = envContent.match(pattern)?.[0];
                const hasExampleValue = examplePatterns.some(example => 
                    line?.toLowerCase().includes(example)
                );
                
                if (hasExampleValue) {
                    this.warnings.push(`${varName} tiene valor de ejemplo`);
                    this.log(`⚠️ ${varName} parece tener valor de ejemplo`, 'warning');
                } else {
                    this.passed.push(`${varName} configurado`);
                    this.log(`✅ ${varName} configurado`, 'green');
                }
            } else {
                this.errors.push(`${varName} falta en .env`);
                this.log(`❌ ${varName} NO está en .env`, 'error');
            }
        }
    }

    checkGitStatus() {
        this.log('\n🔍 Verificando estado de Git...', 'blue');
        
        try {
            const { execSync } = require('child_process');
            
            // Verificar si es un repositorio git
            try {
                execSync('git rev-parse --git-dir', { stdio: 'pipe' });
                this.log('✅ Directorio Git encontrado', 'green');
            } catch (error) {
                this.warnings.push('No es un repositorio Git');
                this.log('⚠️ No es un repositorio Git', 'warning');
                return;
            }
            
            // Verificar si .env está en Git
            try {
                const result = execSync('git ls-files .env', { stdio: 'pipe' }).toString();
                if (result.trim()) {
                    this.errors.push('.env está siendo rastreado por Git');
                    this.log('❌ .env está siendo rastreado por Git', 'error');
                } else {
                    this.passed.push('.env NO está en Git');
                    this.log('✅ .env NO está siendo rastreado por Git', 'green');
                }
            } catch (error) {
                this.passed.push('.env NO está en Git');
                this.log('✅ .env NO está siendo rastreado por Git', 'green');
            }
            
        } catch (error) {
            this.warnings.push('No se pudo verificar Git');
            this.log('⚠️ No se pudo verificar estado de Git', 'warning');
        }
    }

    checkFilePermissions() {
        this.log('\n🔍 Verificando permisos de archivos...', 'blue');
        
        if (process.platform === 'win32') {
            this.log('⚠️ Verificación de permisos omitida en Windows', 'warning');
            return;
        }
        
        if (fs.existsSync('.env')) {
            try {
                const stats = fs.statSync('.env');
                const mode = stats.mode & parseInt('777', 8);
                
                if (mode <= parseInt('600', 8)) {
                    this.passed.push('Permisos de .env correctos');
                    this.log('✅ Permisos de .env son restrictivos', 'green');
                } else {
                    this.warnings.push('Permisos de .env muy permisivos');
                    this.log('⚠️ Permisos de .env podrían ser más restrictivos', 'warning');
                }
            } catch (error) {
                this.warnings.push('No se pudieron verificar permisos');
                this.log('⚠️ No se pudieron verificar permisos de .env', 'warning');
            }
        }
    }

    checkDependencies() {
        this.log('\n🔍 Verificando dependencias de seguridad...', 'blue');
        
        if (!fs.existsSync('package.json')) {
            this.errors.push('package.json no encontrado');
            this.log('❌ package.json no encontrado', 'error');
            return;
        }
        
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const securityPackages = [
            'helmet',
            'express-rate-limit',
            'express-validator',
            'winston',
            'dotenv'
        ];
        
        for (const pkg of securityPackages) {
            if (packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg]) {
                this.passed.push(`Dependencia ${pkg} encontrada`);
                this.log(`✅ ${pkg} está instalado`, 'green');
            } else {
                this.warnings.push(`Dependencia ${pkg} no encontrada`);
                this.log(`⚠️ ${pkg} no está instalado`, 'warning');
            }
        }
    }

    generateReport() {
        this.log('\n📊 RESUMEN DE VERIFICACIÓN', 'blue');
        this.log('='.repeat(50), 'blue');
        
        this.log(`\n✅ Verificaciones exitosas: ${this.passed.length}`, 'green');
        this.log(`⚠️ Advertencias: ${this.warnings.length}`, 'warning');
        this.log(`❌ Errores críticos: ${this.errors.length}`, 'error');
        
        if (this.errors.length > 0) {
            this.log('\n🚨 ERRORES CRÍTICOS:', 'error');
            this.errors.forEach(error => this.log(`  - ${error}`, 'error'));
        }
        
        if (this.warnings.length > 0) {
            this.log('\n⚠️ ADVERTENCIAS:', 'warning');
            this.warnings.forEach(warning => this.log(`  - ${warning}`, 'warning'));
        }
        
        this.log('\n📋 RECOMENDACIONES:', 'blue');
        
        if (this.errors.length > 0) {
            this.log('  1. Corregir errores críticos antes de continuar', 'red');
        }
        
        if (!fs.existsSync('.env') && fs.existsSync('.env.example')) {
            this.log('  2. Crear .env basado en .env.example', 'yellow');
        }
        
        this.log('  3. Verificar que las credenciales sean correctas', 'yellow');
        this.log('  4. Nunca subir archivos .env a Git', 'yellow');
        this.log('  5. Rotar credenciales regularmente', 'yellow');
        
        const status = this.errors.length === 0 ? 'APROBADO' : 'REQUIERE ATENCIÓN';
        const statusColor = this.errors.length === 0 ? 'green' : 'red';
        
        this.log(`\n🎯 Estado: ${status}`, statusColor);
        
        return this.errors.length === 0;
    }

    run() {
        this.log('🔐 VERIFICACIÓN DE SEGURIDAD - Power BI Backend', 'blue');
        this.log('='.repeat(50), 'blue');
        
        this.checkGitignore();
        this.checkEnvFiles();
        this.checkGitStatus();
        this.checkFilePermissions();
        this.checkDependencies();
        
        return this.generateReport();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    const checker = new SecurityChecker();
    const passed = checker.run();
    process.exit(passed ? 0 : 1);
}

module.exports = SecurityChecker;
