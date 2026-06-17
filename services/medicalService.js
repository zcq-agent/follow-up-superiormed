const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// 尝试加载依赖库，如果失败则标记为不可用
let pdfParse = null;
let XLSX = null;
let mammoth = null;

try {
    pdfParse = require('pdf-parse');
} catch (e) {
    console.warn('⚠️  pdf-parse not available:', e.message);
}

try {
    XLSX = require('xlsx');
} catch (e) {
    console.warn('⚠️  xlsx not available:', e.message);
}

try {
    mammoth = require('mammoth');
} catch (e) {
    console.warn('⚠️  mammoth not available:', e.message);
}

// 检测文件类型
function getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    console.log('getFileType - filePath:', filePath);
    console.log('getFileType - ext:', ext);
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
    const result = mimeTypes[ext] || 'unknown';
    console.log('getFileType - result:', result);
    return result;
}

// 提取PDF文本 - 使用智谱 API 进行 PDF 识别
async function extractPDF(filePath) {
    console.log('使用智谱 API 进行 PDF 识别');
    return await extractFromImage(filePath, 'PDF文档');
}

// 提取Word文本 - 使用智谱 API 进行 Word 识别
async function extractWord(filePath) {
    console.log('使用智谱 API 进行 Word 识别');
    return await extractFromImage(filePath, 'Word文档');
}

// 提取Excel文本 - 使用智谱 API 进行 Excel 识别
async function extractExcel(filePath) {
    console.log('使用智谱 API 进行 Excel 识别');
    return await extractFromImage(filePath, 'Excel表格');
}

// 调用智谱GLM-4V API - 统一的文档数据提取入口
async function extractMedicalData(filePath, documentType) {
    try {
        console.log('=== 开始文档数据提取 ===');
        console.log('文件路径:', filePath);
        console.log('文档类型:', documentType);

        const fileType = getFileType(filePath);
        console.log('检测到的文件类型:', fileType);

        let extractedText = '';

        // 根据文件类型选择提取方法
        switch (fileType) {
            case 'pdf':
                console.log('使用 PDF 解析');
                try {
                    extractedText = await extractPDF(filePath);
                } catch (pdfError) {
                    return {
                        success: false,
                        error: `PDF解析失败: ${pdfError.message}`,
                        data: null,
                        debug: {
                            filePath: filePath,
                            fileType: fileType,
                            detectedExt: path.extname(filePath)
                        }
                    };
                }
                break;

            case 'word':
                console.log('使用 Word 解析');
                try {
                    extractedText = await extractWord(filePath);
                } catch (wordError) {
                    return {
                        success: false,
                        error: `Word解析失败: ${wordError.message}`,
                        data: null,
                        debug: {
                            filePath: filePath,
                            fileType: fileType,
                            detectedExt: path.extname(filePath)
                        }
                    };
                }
                break;

            case 'excel':
                console.log('使用 Excel 解析');
                try {
                    extractedText = await extractExcel(filePath);
                } catch (excelError) {
                    return {
                        success: false,
                        error: `Excel解析失败: ${excelError.message}`,
                        data: null,
                        debug: {
                            filePath: filePath,
                            fileType: fileType,
                            detectedExt: path.extname(filePath)
                        }
                    };
                }
                break;

            case 'image':
                console.log('使用 OCR 图片识别');
                return await extractFromImage(filePath, documentType);

            default:
                return {
                    success: false,
                    error: `不支持的文件类型: ${fileType}`,
                    data: null,
                    debug: {
                        filePath: filePath,
                        fileType: fileType,
                        detectedExt: path.extname(filePath)
                    }
                };
        }

        // 对于 PDF/Word/Excel，直接返回提取的文本
        // 这些格式的文本提取是精确的，保持了原始格式
        return {
            success: true,
            data: {
                fullContent: extractedText,
                type: documentType
            },
            rawContent: extractedText,
            confidence: 'high'
        };

    } catch (error) {
        console.error('=== 文档数据提取失败 ===');
        console.error('错误类型:', error.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
        return {
            success: false,
            error: error.message || '未知错误',
            data: null,
            debug: {
                filePath: typeof filePath !== 'undefined' ? filePath : 'undefined',
                errorStage: 'extraction'
            }
        };
    }
}

// 图片OCR识别 - 调用智谱GLM-4V API（支持图片、PDF、Word、Excel）
async function extractFromImage(imagePath, documentType) {
    try {
        console.log('=== 开始多模态识别 ===');
        console.log('文件路径:', imagePath);
        console.log('文档类型:', documentType);

        const apiKey = process.env.ZHIPU_API_KEY;
        console.log('API Key存在:', !!apiKey);
        if (!apiKey) {
            console.error('ZHIPU_API_KEY 未配置');
            return {
                success: false,
                error: 'ZHIPU_API_KEY 未配置，请在 Railway 环境变量中设置',
                data: null
            };
        }

        // 读取文件并转换为base64
        const fileBuffer = fs.readFileSync(imagePath);
        const base64File = fileBuffer.toString('base64');

        // 根据文件扩展名确定 MIME 类型
        const ext = path.extname(imagePath).toLowerCase();
        let mimeType;
        switch (ext) {
            case '.pdf':
                mimeType = 'application/pdf';
                break;
            case '.jpg':
            case '.jpeg':
                mimeType = 'image/jpeg';
                break;
            case '.png':
                mimeType = 'image/png';
                break;
            case '.docx':
                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                break;
            case '.xlsx':
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                break;
            default:
                mimeType = 'image/jpeg'; // 默认
        }

        console.log('文件类型:', mimeType);
        console.log('文件大小:', fileBuffer.length, 'bytes');

        // 构建请求
        const requestBody = {
            model: 'glm-4v',
            messages: [
                {
                    role: 'system',
                    content: `你是一个严格的专业文档文字识别系统。你的唯一任务是从文档（图片、PDF、Word、Excel等）中识别文字，并严格按照原始格式输出。

【严格要求】：
1. 完全保留文档中的所有文字、数字、符号，不得遗漏任何内容
2. 保持文字在文档中的原始位置和顺序，不得重新排列
3. 保留原始的格式（换行、空格、缩进、表格结构等），不得添加或删除
4. 绝对禁止对内容进行任何分析、解释、总结、归纳或评论
5. 绝对禁止修改任何数值、单位、日期等
6. 即使遇到看似错误或不合理的内容，也必须原样输出，不得"修正"
7. 输出的内容必须与文档中显示的一模一样，就像复印一样
8. 对于表格，保持表格结构和内容完整

【输出格式】：
直接输出识别的所有文字内容，保持原始排版和格式，不要添加任何前后缀说明。`
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64File}`
                            }
                        },
                        {
                            type: 'text',
                            text: '请严格按照原始格式识别文档中的所有文字、数字、符号。不要遗漏任何内容，不要修改任何数值，不要添加任何分析或总结。直接输出识别的原始内容。'
                        }
                    ]
                }
            ],
            top_p: 0.1,
            temperature: 0.01,
            max_tokens: 4096  // 增加最大token数以支持更长的文档
        };

        // 调用API
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            timeout: 30000
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error('API错误响应:', responseText);
            return {
                success: false,
                error: `API返回错误: ${response.status}`,
                data: null
            };
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('JSON解析错误:', responseText);
            return {
                success: false,
                error: 'API响应无效',
                data: null
            };
        }

        if (data.error) {
            return {
                success: false,
                error: data.error.message || '未知错误',
                data: null
            };
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            return {
                success: false,
                error: 'API响应格式异常',
                data: null
            };
        }

        const content = data.choices[0].message.content;

        // 直接返回完整的识别文本内容
        return {
            success: true,
            data: {
                fullContent: content,
                type: documentType
            },
            rawContent: content,
            confidence: 'high'
        };

    } catch (error) {
        console.error('=== 图片OCR识别失败 ===');
        console.error('错误类型:', error.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
        return {
            success: false,
            error: error.message || '未知错误',
            data: null
        };
    }
}

// 解析文本响应为JSON
function parseTextResponse(content, documentType) {
    const result = {
        patientInfo: {},
        testInfo: {},
        results: [],
        notes: content.substring(0, 500) // 前500字符作为备注
    };

    // 简单的文本解析逻辑
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.includes('姓名')) {
            const match = line.match(/姓名[：:]\s*(.+)/);
            if (match) result.patientInfo.name = match[1].trim();
        }
        if (line.includes('年龄')) {
            const match = line.match(/年龄[：:]\s*(.+)/);
            if (match) result.patientInfo.age = match[1].trim();
        }
        if (line.includes('日期')) {
            const match = line.match(/日期[：:]\s*(.+)/);
            if (match) result.testInfo.testDate = match[1].trim();
        }
    }

    return result;
}

module.exports = {
    extractMedicalData,
    getFileType,
    extractPDF,
    extractWord,
    extractExcel
};
