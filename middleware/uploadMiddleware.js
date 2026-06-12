const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../data/uploads');
console.log('📁 Upload directory:', uploadDir);

try {
    if (!fs.existsSync(uploadDir)) {
        console.log('Creating upload directory...');
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('✅ Upload directory created');
    } else {
        console.log('✅ Upload directory exists');
    }

    // 测试写入权限
    const testFile = path.join(uploadDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ Upload directory is writable');
} catch (error) {
    console.error('❌ Upload directory error:', error);
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

// 文件过滤 - 支持图片、PDF、Word、Excel
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        // 图片
        'image/jpeg', 'image/png', 'image/jpg',
        // PDF
        'application/pdf',
        // Word
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // Excel
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];

    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件格式，仅支持图片（JPG/PNG）、PDF、Word（.doc/.docx）和Excel（.xls/.xlsx）'), false);
    }
};

// Multer配置
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB限制 - 支持较大的文档文件
        files: 20 // 最多20个文件
    }
});

module.exports = upload;
