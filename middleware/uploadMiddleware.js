const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../data/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 存储配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const ext = path.extname(file.originalname);
        const uuid = uuidv4().substring(0, 8);
        cb(null, `${timestamp}-${uuid}${ext}`);
    }
});

// 文件过滤
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    const allowedExts = ['.jpg', '.jpeg', '.png'];

    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('仅支持JPG和PNG格式的图片'), false);
    }
};

// Multer配置
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB限制
    }
});

module.exports = upload;
