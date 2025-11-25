/**
 * 分步部署脚本
 * 
 * 步骤:
 * 1. 安装前端依赖
 * 2. 构建 Vue 前端
 * 3. 部署 Worker（包含静态资源）
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT_DIR = path.resolve(__dirname, '..')
const VIEW_DIR = path.join(ROOT_DIR, 'view')

function run(command, cwd = ROOT_DIR) {
    console.log(`\n📌 执行: ${command}`)
    console.log(`   目录: ${cwd}\n`)
    try {
        execSync(command, {
            cwd,
            stdio: 'inherit',
            shell: true
        })
        return true
    } catch (error) {
        console.error(`❌ 命令执行失败: ${command}`)
        return false
    }
}

function checkDir(dir, name) {
    if (!fs.existsSync(dir)) {
        console.error(`❌ ${name} 目录不存在: ${dir}`)
        process.exit(1)
    }
}

async function main() {
    console.log('🚀 开始部署 Messages Bundler Bot\n')
    console.log('='.repeat(50))

    // 检查目录
    checkDir(ROOT_DIR, '项目根')
    checkDir(VIEW_DIR, '前端')

    // 步骤 1: 安装前端依赖
    console.log('\n📦 步骤 1/3: 安装前端依赖')
    console.log('-'.repeat(50))

    if (!run('pnpm install', VIEW_DIR)) {
        console.error('❌ 前端依赖安装失败')
        process.exit(1)
    }
    console.log('✅ 前端依赖安装完成')

    // 步骤 2: 构建前端
    console.log('\n🔨 步骤 2/3: 构建前端')
    console.log('-'.repeat(50))

    if (!run('pnpm run build', path.join(VIEW_DIR, 'main'))) {
        console.error('❌ 前端构建失败')
        process.exit(1)
    }

    // 检查构建产物
    const distDir = path.join(VIEW_DIR, 'main', 'dist')
    if (!fs.existsSync(distDir)) {
        console.error(`❌ 构建产物目录不存在: ${distDir}`)
        process.exit(1)
    }

    const files = fs.readdirSync(distDir)
    console.log(`✅ 前端构建完成，产物: ${files.length} 个文件`)

    // 步骤 3: 部署 Worker
    console.log('\n☁️  步骤 3/3: 部署到 Cloudflare')
    console.log('-'.repeat(50))

    if (!run('pnpm run deploy', ROOT_DIR)) {
        console.error('❌ Worker 部署失败')
        process.exit(1)
    }

    console.log('\n' + '='.repeat(50))
    console.log('🎉 部署完成!')
    console.log('')
    console.log('📍 Worker 已部署到 Cloudflare')
    console.log('📍 查看 wrangler.toml 中配置的域名')
    console.log('')
    console.log('💡 提示:')
    console.log('   - 确保已在 BotFather 配置 Mini App URL')
    console.log('   - Mini App URL 格式: https://your.domain.com/view/')
    console.log('')
}

main().catch(err => {
    console.error('❌ 部署脚本出错:', err)
    process.exit(1)
})
