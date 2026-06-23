/**
 * 환경 검증 스크립트
 * 
 * Purpose: 서버 시작 전 필수 환경 설정과 의존성을 검증합니다.
 * Usage: npm run verify 또는 postinstall 시 자동 실행
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function log(message: string, color: string = COLORS.reset) {
    console.log(`${color}${message}${COLORS.reset}`);
}

function checkNodeVersion() {
    log('\n📦 Node.js 버전 확인...', COLORS.blue);

    const currentVersion = process.version;
    const requiredMajor = 18; // Minimum Node.js version
    const currentMajor = parseInt(currentVersion.split('.')[0].slice(1));

    if (currentMajor >= requiredMajor) {
        log(`✅ Node.js ${currentVersion} (요구: v${requiredMajor}+)`, COLORS.green);
        return true;
    } else {
        log(`❌ Node.js 버전이 너무 낮습니다. 현재: ${currentVersion}, 요구: v${requiredMajor}+`, COLORS.red);
        return false;
    }
}

function checkRequiredEnvVars() {
    log('\n🔐 필수 환경변수 확인...', COLORS.blue);

    const requiredVars = [
        'DATABASE_URL',
        'SESSION_SECRET',
        'JWT_SECRET',
    ];

    const missingVars: string[] = [];

    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length === 0) {
        log(`✅ 모든 필수 환경변수가 설정되었습니다.`, COLORS.green);
        return true;
    } else {
        log(`❌ 누락된 환경변수: ${missingVars.join(', ')}`, COLORS.red);
        log(`💡 .env 파일을 확인하세요.`, COLORS.yellow);
        return false;
    }
}

function checkPackageJson() {
    log('\n📋 package.json 검증...', COLORS.blue);

    const packagePath = join(process.cwd(), 'package.json');

    if (!existsSync(packagePath)) {
        log(`❌ package.json을 찾을 수 없습니다.`, COLORS.red);
        return false;
    }

    try {
        const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));

        // Critical dependencies check
        const criticalDeps = [
            'express',
            'drizzle-orm',
            'dotenv',
            'tsx',
        ];

        const missingDeps = criticalDeps.filter(dep =>
            !pkg.dependencies?.[dep] && !pkg.devDependencies?.[dep]
        );

        if (missingDeps.length === 0) {
            log(`✅ 모든 핵심 의존성이 정의되었습니다.`, COLORS.green);
            return true;
        } else {
            log(`❌ 누락된 핵심 의존성: ${missingDeps.join(', ')}`, COLORS.red);
            return false;
        }
    } catch (error) {
        log(`❌ package.json 파싱 실패: ${error}`, COLORS.red);
        return false;
    }
}

function checkNodeModules() {
    log('\n📦 node_modules 상태 확인...', COLORS.blue);

    const nodeModulesPath = join(process.cwd(), 'node_modules');

    if (!existsSync(nodeModulesPath)) {
        log(`⚠️  node_modules가 존재하지 않습니다. npm install을 실행하세요.`, COLORS.yellow);
        return false;
    }

    // Check if express exists (as a proxy for successful install)
    const expressPath = join(nodeModulesPath, 'express');
    if (!existsSync(expressPath)) {
        log(`⚠️  의존성이 불완전합니다. npm install을 다시 실행하세요.`, COLORS.yellow);
        return false;
    }

    log(`✅ node_modules가 정상적으로 설치되었습니다.`, COLORS.green);
    return true;
}

function checkGitStatus() {
    log('\n🔄 Git 상태 확인...', COLORS.blue);

    try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
        const hasNodeModulesChanges = gitStatus.includes('node_modules');

        if (hasNodeModulesChanges) {
            log(`⚠️  node_modules에 Git 변경사항이 감지되었습니다.`, COLORS.yellow);
            log(`💡 Git 변경 후에는 'npm install'을 실행하세요.`, COLORS.yellow);
        } else {
            log(`✅ Git 상태 정상`, COLORS.green);
        }

        return true;
    } catch (error) {
        log(`⚠️  Git 저장소가 아니거나 Git이 설치되지 않았습니다.`, COLORS.yellow);
        return true; // Not critical
    }
}

function printPostCheckReminder() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', COLORS.blue);
    log('📌 Git 작업 후 필수 체크리스트', COLORS.blue);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', COLORS.blue);
    log('');
    log('git reset, git checkout, git pull 등을 실행한 후에는:', COLORS.yellow);
    log('  1️⃣  Remove-Item -Recurse -Force node_modules', COLORS.yellow);
    log('  2️⃣  Remove-Item -Force package-lock.json', COLORS.yellow);
    log('  3️⃣  npm install', COLORS.yellow);
    log('  4️⃣  npm run dev', COLORS.yellow);
    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', COLORS.blue);
}

// Main execution
async function main() {
    log('\n🔍 환경 검증 시작...', COLORS.blue);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const checks = [
        checkNodeVersion(),
        checkPackageJson(),
        checkNodeModules(),
        checkRequiredEnvVars(),
        checkGitStatus(),
    ];

    const allPassed = checks.every(result => result === true);

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (allPassed) {
        log('✅ 모든 검증 통과! 서버를 시작할 수 있습니다.', COLORS.green);
        printPostCheckReminder();
        process.exit(0);
    } else {
        log('❌ 일부 검증 실패. 위의 메시지를 확인하고 문제를 해결하세요.', COLORS.red);
        printPostCheckReminder();
        process.exit(1);
    }
}

main().catch(error => {
    log(`\n❌ 검증 중 예외 발생: ${error}`, COLORS.red);
    process.exit(1);
});
