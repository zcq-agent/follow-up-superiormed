// Railway 优化版本 - v2
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 健康检查端点（Railway 标准）
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// 根路径
app.get('/', (req, res) => {
    res.send('Follow-up System is Running!');
});

// 加载主服务器（延迟加载避免启动时的问题）
let mainServerLoaded = false;

async function loadMainServer() {
    try {
        console.log('🔍 Loading main server...');

        // 创建数据目录
        const fs = require('fs');
        const path = require('path');

        const dataDir = path.join(__dirname, 'data');
        const uploadsDir = path.join(dataDir, 'uploads');

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('✅ Created data directory');
        }

        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('✅ Created uploads directory');
        }

        // 加载完整的服务器
        const serverModule = require('./server.js');
        mainServerLoaded = true;
        console.log('✅ Main server loaded successfully');

    } catch (error) {
        console.error('❌ Failed to load main server:', error.message);
        // 继续运行基础服务器
    }
}

// 启动基础服务器
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server listening on port ${PORT}`);
    console.log(`✅ Health check ready`);

    // 延迟加载主服务器
    setTimeout(() => {
        loadMainServer();
    }, 1000);
});

// 保持容器运行 - 定期输出心跳
setInterval(() => {
    const uptime = Math.floor(process.uptime());
    console.log(`💓 Heartbeat - Server running for ${uptime}s`);
}, 30000);

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('⚠️  SIGINT received, shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // 不退出，继续运行
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    // 不退出，继续运行
});
