const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { extractMedicalData } = require('../services/medicalService');
const fs = require('fs');
const path = require('path');

// 认证中间件
function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: '未授权，请先登录' });
    }
}

// POST /api/medical/upload - 上传医疗文件（支持批量，支持图片、PDF、Word、Excel）
router.post('/upload', (req, res, next) => {
    console.log('=== 文件上传请求 ===');
    console.log('Session auth:', req.session?.authenticated);
    console.log('Headers:', req.headers['content-type']);

    // 临时禁用认证用于测试
    // requireAuth(req, res, next);
    next();
}, upload.array('files', 20), (req, res) => {
    console.log('=== Multer 处理后 ===');
    console.log('上传文件数量:', req.files?.length);
    console.log('请求体:', req.body);

    if (!req.files || req.files.length === 0) {
        console.error('上传失败: 未上传文件');
        return res.status(400).json({ success: false, message: '未上传文件' });
    }

    // 处理所有上传的文件
    const uploadedFiles = req.files.map(file => ({
        imageId: file.filename,
        filePath: `/data/uploads/${file.filename}`,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size
    }));

    const response = {
        success: true,
        files: uploadedFiles,
        message: `成功上传 ${uploadedFiles.length} 个文件`
    };
    console.log('上传响应:', response);
    res.json(response);
});

// POST /api/medical/extract - 识别医疗数据
router.post('/extract', (req, res, next) => {
    // 临时禁用认证
    console.log('=== 收到识别请求 ===');
    console.log('请求体:', req.body);
    next();
}, async (req, res) => {
    const { imageId, documentType } = req.body;

    console.log('=== 开始处理识别请求 ===');
    console.log('imageId:', imageId);
    console.log('documentType:', documentType);

    if (!imageId || !documentType) {
        console.log('❌ 缺少参数');
        return res.status(400).json({
            success: false,
            message: '缺少imageId或documentType参数'
        });
    }

    try {
        const imagePath = path.join(__dirname, '../data/uploads', imageId);
        console.log('图片路径:', imagePath);

        if (!fs.existsSync(imagePath)) {
            console.log('❌ 图片不存在');
            return res.status(404).json({
                success: false,
                message: '图片不存在'
            });
        }

        console.log(`✅ 开始识别医疗数据: ${imageId}, 类型: ${documentType}`);
        const result = await extractMedicalData(imagePath, documentType);
        console.log('识别结果:', result.success ? '成功' : '失败');

        if (result.success) {
            res.json({
                success: true,
                data: result.data,
                confidence: result.confidence,
                message: '识别成功'
            });
        } else {
            console.log('❌ 识别失败:', result.error);
            res.status(500).json({
                success: false,
                message: '识别失败: ' + result.error
            });
        }
    } catch (error) {
        console.error('❌ API错误:', error);
        console.error('❌ 错误堆栈:', error.stack);
        res.status(500).json({
            success: false,
            message: '服务器错误: ' + error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// POST /api/medical/confirm - 确认并保存医疗数据到客户记录
router.post('/confirm', requireAuth, (req, res) => {
    const { clientId, extractedData, imageId, documentType } = req.body;

    if (!clientId || !extractedData) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数'
        });
    }

    try {
        // 这里会在server.js中注入clients数据
        // 临时返回成功响应，具体保存逻辑在server.js中处理
        res.json({
            success: true,
            message: '数据已保存',
            recordId: Date.now(),
            clientId: clientId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '保存失败: ' + error.message
        });
    }
});

// GET /api/medical/test-env - 测试环境变量配置（调试用）
router.get('/test-env', (req, res) => {
    res.json({
        ZHIPU_API_KEY_CONFIGURED: !!process.env.ZHIPU_API_KEY,
        SEND_KEY_CONFIGURED: !!process.env.SEND_KEY,
        ADMIN_PASSWORD_CONFIGURED: !!process.env.ADMIN_PASSWORD,
        NODE_ENV: process.env.NODE_ENV || 'undefined'
    });
});

// GET /api/medical/test-file-type - 测试文件类型检测（调试用）
router.get('/test-file-type', (req, res) => {
    const path = require('path');
    const testFiles = [
        'test.png',
        'test.jpg',
        'test.pdf',
        'test.docx',
        '2026-06-13T08-34-48-123Z-abc12345.png'
    ];

    const results = testFiles.map(file => {
        const ext = path.extname(file).toLowerCase();
        const mimeTypes = {
            '.pdf': 'pdf',
            '.doc': 'word',
            '.docx': 'word',
            '.xls': 'excel',
            '.xlsx': 'excel',
            '.jpg': 'image',
            '.jpeg': 'image',
            '.png': 'image'
        };
        return {
            file: file,
            ext: ext,
            detectedType: mimeTypes[ext] || 'unknown'
        };
    });

    res.json({
        message: '文件类型检测测试',
        results: results
    });
});
router.get('/test-env', (req, res) => {
    res.json({
        ZHIPU_API_KEY_CONFIGURED: !!process.env.ZHIPU_API_KEY,
        SEND_KEY_CONFIGURED: !!process.env.SEND_KEY,
        ADMIN_PASSWORD_CONFIGURED: !!process.env.ADMIN_PASSWORD,
        NODE_ENV: process.env.NODE_ENV || 'undefined'
    });
});

// DELETE /api/medical/:imageId - 删除上传的图片
router.delete('/:imageId', requireAuth, (req, res) => {
    const { imageId } = req.params;

    try {
        const imagePath = path.join(__dirname, '../data/uploads', imageId);

        if (!fs.existsSync(imagePath)) {
            return res.status(404).json({
                success: false,
                message: '图片不存在'
            });
        }

        fs.unlinkSync(imagePath);
        res.json({
            success: true,
            message: '图片已删除'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '删除失败: ' + error.message
        });
    }
});

module.exports = router;
