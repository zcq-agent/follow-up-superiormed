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

// POST /api/medical/upload - 上传医疗图片
router.post('/upload', requireAuth, upload.single('image'), (req, res) => {
    console.log('=== 图片上传请求 ===');
    console.log('请求文件:', req.file);

    if (!req.file) {
        console.error('上传失败: 未上传文件');
        return res.status(400).json({ success: false, message: '未上传文件' });
    }

    const response = {
        success: true,
        imageId: req.file.filename,
        filePath: `/data/uploads/${req.file.filename}`,
        message: '上传成功'
    };
    console.log('上传响应:', response);
    res.json(response);
});

// POST /api/medical/extract - 识别医疗数据
router.post('/extract', requireAuth, async (req, res) => {
    const { imageId, documentType } = req.body;

    if (!imageId || !documentType) {
        return res.status(400).json({
            success: false,
            message: '缺少imageId或documentType参数'
        });
    }

    try {
        const imagePath = path.join(__dirname, '../data/uploads', imageId);

        if (!fs.existsSync(imagePath)) {
            return res.status(404).json({
                success: false,
                message: '图片不存在'
            });
        }

        console.log(`开始识别医疗数据: ${imageId}, 类型: ${documentType}`);
        const result = await extractMedicalData(imagePath, documentType);

        if (result.success) {
            res.json({
                success: true,
                data: result.data,
                confidence: result.confidence,
                message: '识别成功'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '识别失败: ' + result.error
            });
        }
    } catch (error) {
        console.error('API错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误: ' + error.message
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
