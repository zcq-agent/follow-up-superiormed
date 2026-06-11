const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// 数据目录初始化
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

console.log('🔍 Initializing directories...');
console.log('DATA_DIR:', DATA_DIR);
console.log('UPLOADS_DIR:', UPLOADS_DIR);

try {
    if (!fs.existsSync(DATA_DIR)) {
        console.log('Creating DATA_DIR...');
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
        console.log('Creating UPLOADS_DIR...');
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    console.log('✅ Directories ready');
} catch (error) {
    console.error('❌ Directory creation failed:', error);
}

// 静态文件
app.use(express.static('.'));

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running!' });
});

// 导入路由（逐步添加）
console.log('🔍 Loading routes...');

try {
    const medicalRoutes = require('./routes/medicalRoutes');
    app.use('/api/medical', medicalRoutes);
    console.log('✅ Medical routes loaded');
} catch (error) {
    console.error('❌ Medical routes failed to load:', error);
}

// 启动服务器
const PORT = process.env.PORT || 3000;

console.log('🔍 Starting server...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

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
