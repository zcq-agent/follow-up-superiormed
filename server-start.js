// 优化的服务器 - 快速启动
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 立即响应健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
    res.send('Follow-up System Running');
});

// 延迟加载其他模块
setTimeout(() => {
    try {
        // 加载主服务器
        delete require.cache[require.resolve('./server.js')];
        require('./server.js');
        console.log('✅ Main server loaded');
    } catch (error) {
        console.error('❌ Failed to load main server:', error);
    }
}, 100);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// 保持服务运行
setInterval(() => {
    // 心跳
}, 30000);

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, closing gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
