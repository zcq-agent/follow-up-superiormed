// 简化版服务器用于测试 Railway 部署
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running!' });
});

// 根路径
app.get('/', (req, res) => {
    res.send('Follow-up System is running!');
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/health`);
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});
