// Railway 启动文件
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// 立即创建必要的目录（在加载任何模块之前）
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(dataDir, 'uploads');

try {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('✅ Created data directory');
    }
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('✅ Created uploads directory');
    }
    console.log('✅ Directories ready');
} catch (error) {
    console.error('❌ Failed to create directories:', error);
}

// 加载主服务器
const app = require('./server.js');

// 启动服务器
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server listening on port ${PORT}`);
    console.log(`✅ Health check ready: http://0.0.0.0:${PORT}/health`);
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
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});
