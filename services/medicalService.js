const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const xlsx = require('xlsx');
const mammoth = require('mammoth');

// 调用智谱GLM-4V API
async function extractMedicalData(imagePath, documentType) {
    try {
        console.log('=== 开始文档识别 ===');
        console.log('文件路径:', imagePath);
        console.log('文档类型:', documentType);

        // 检测文件类型
        const ext = path.extname(imagePath).toLowerCase();
        const mimeType = getMimeType(ext);

        console.log('检测到文件类型:', ext, mimeType);

        // 对于PDF、Word、Excel文档，先提取文本内容
        if (ext === '.pdf') {
            return await extractFromPDF(imagePath, documentType);
        } else if (ext === '.docx' || ext === '.doc') {
            return await extractFromWord(imagePath, documentType);
        } else if (ext === '.xlsx' || ext === '.xls') {
            return await extractFromExcel(imagePath, documentType);
        }

        // 图片文件使用OCR识别
        const apiKey = process.env.ZHIPU_API_KEY;
        console.log('API Key存在:', !!apiKey);
        if (!apiKey) {
            console.error('ZHIPU_API_KEY 未配置');
            return {
                success: false,
                error: 'ZHIPU_API_KEY 未配置',
                data: null
            };
        }

        // 读取图片并转换为base64
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        const imgMimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        console.log('图片大小:', imageBuffer.length, 'bytes');

        // 构建请求
        const requestBody = {
            model: 'glm-4v',
            messages: [
                {
                    role: 'system',
                    content: `你是一个严格的专业OCR文字识别系统。你的唯一任务是从图片中识别文字，并严格按照原始格式输出。

【严格要求】：
1. 完全保留图片中的所有文字、数字、符号，不得遗漏任何内容
2. 保持文字在图片中的原始位置和顺序，不得重新排列
3. 保留原始的格式（换行、空格、缩进等），不得添加或删除
4. 绝对禁止对内容进行任何分析、解释、总结、归纳或评论
5. 绝对禁止修改任何数值、单位、日期等
6. 即使遇到看似错误或不合理的内容，也必须原样输出，不得"修正"
7. 输出的内容必须与图片中显示的一模一样，就像复印一样

【输出格式】：
直接输出识别的所有文字内容，保持原始排版和格式，不要添加任何前后缀说明。`
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        },
                        {
                            type: 'text',
                            text: '请严格按照原始格式识别图片中的所有文字、数字、符号。不要遗漏任何内容，不要修改任何数值，不要添加任何分析或总结。直接输出识别的原始内容。'
                        }
                    ]
                }
            ],
            top_p: 0.1,
            temperature: 0.01,
            max_tokens: 2048
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
        console.error('医疗数据提取失败:', error);
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

// 获取MIME类型
function getMimeType(ext) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// 从PDF提取文本
async function extractFromPDF(filePath, documentType) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);

        return {
            success: true,
            data: {
                fullContent: data.text,
                type: documentType || 'PDF文档'
            },
            confidence: 'high'
        };
    } catch (error) {
        console.error('PDF提取失败:', error);
        return {
            success: false,
            error: 'PDF解析失败: ' + error.message
        };
    }
}

// 从Word提取文本
async function extractFromWord(filePath, documentType) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer: dataBuffer });

        return {
            success: true,
            data: {
                fullContent: result.value,
                type: documentType || 'Word文档'
            },
            confidence: 'high'
        };
    } catch (error) {
        console.error('Word提取失败:', error);
        return {
            success: false,
            error: 'Word文档解析失败: ' + error.message
        };
    }
}

// 从Excel提取数据
async function extractFromExcel(filePath, documentType) {
    try {
        const workbook = xlsx.readFile(filePath);
        let fullContent = '';

        // 遍历所有工作表
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const sheetData = xlsx.utils.sheet_to_csv(worksheet, { header: 1 });
            fullContent += `### 工作表: ${sheetName}\n${sheetData}\n\n`;
        });

        return {
            success: true,
            data: {
                fullContent: fullContent,
                type: documentType || 'Excel表格'
            },
            confidence: 'high'
        };
    } catch (error) {
        console.error('Excel提取失败:', error);
        return {
            success: false,
            error: 'Excel解析失败: ' + error.message
        };
    }
}

module.exports = {
    extractMedicalData
};
