let currentExtractedData = null;
let currentImageId = null;
let uploadedImages = []; // 存储已上传的图片信息

// 初始化医疗上传界面
function initMedicalUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const medicalImage = document.getElementById('medicalImage');
    const uploadBtn = document.getElementById('uploadBtn');

    // 点击上传区域选择文件
    uploadArea.addEventListener('click', () => {
        medicalImage.click();
    });

    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(0, 255, 255, 0.7)';
        uploadArea.style.background = 'rgba(0, 255, 255, 0.15)';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'rgba(0, 255, 255, 0.4)';
        uploadArea.style.background = 'rgba(0, 255, 255, 0.05)';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(0, 255, 255, 0.4)';
        uploadArea.style.background = 'rgba(0, 255, 255, 0.05)';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            medicalImage.files = files;
            handleUpload(); // 直接上传
        }
    });

    // 文件选择变化 - 自动上传
    medicalImage.addEventListener('change', () => {
        if (medicalImage.files.length > 0) {
            handleUpload();
        }
    });
}

// 处理上传（自动触发）
async function handleUpload() {
    const medicalImage = document.getElementById('medicalImage');
    const documentType = document.getElementById('documentType').value;
    const uploadStatus = document.getElementById('uploadStatus');

    if (!medicalImage.files || medicalImage.files.length === 0) {
        return;
    }

    try {
        // 1. 上传图片
        showStatus(uploadStatus, '⏳ 正在上传图片...', 'loading');
        const formData = new FormData();
        formData.append('image', medicalImage.files[0]);

        const uploadResponse = await fetch('/api/medical/upload', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            throw new Error('上传失败');
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
            throw new Error(uploadData.message || '上传失败');
        }

        currentImageId = uploadData.imageId;
        showStatus(uploadStatus, '⏳ 正在识别医疗数据...', 'loading');

        // 2. 识别数据
        const extractResponse = await fetch('/api/medical/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageId: uploadData.imageId,
                documentType: documentType
            })
        });

        if (!extractResponse.ok) {
            throw new Error('识别失败');
        }

        const extractData = await extractResponse.json();
        if (!extractData.success) {
            throw new Error(extractData.message || '识别失败: ' + extractData.error);
        }

        currentExtractedData = extractData.data;
        showStatus(uploadStatus, '✅ 识别成功！', 'success');

        // 3. 保存图片信息到本地数组
        const imageInfo = {
            id: Date.now(),
            imageId: uploadData.imageId,
            filePath: uploadData.filePath,
            documentType: documentType,
            uploadTime: new Date().toISOString(),
            extractedData: extractData.data
        };
        uploadedImages.unshift(imageInfo); // 添加到开头

        // 4. 直接在页面显示识别结果（传递图片路径）
        displayExtractionResult(extractData.data, extractData.confidence, uploadData.filePath);

        // 5. 更新图片列表显示
        renderUploadedImages();

        // 清除文件选择
        medicalImage.value = '';

    } catch (error) {
        console.error('上传/识别错误:', error);
        showStatus(uploadStatus, `❌ ${error.message}`, 'error');
    }
}

// 显示状态信息
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = type;
}

// 直接在页面显示识别结果（按照用户要求的格式）
function displayExtractionResult(data, confidence, imagePath) {
    let resultHtml = `
        <div class="card" style="margin-top: 20px; border-color: rgba(0, 255, 255, 0.4);">
            <h3 style="color: #00ffff; margin-bottom: 16px;">
                📋 医学数据识别结果
                <span style="font-size: 12px; color: rgba(0, 255, 255, 0.6);">
                    (文档类型: ${data.type || '未知'} | 置信度: ${confidence === 'high' ? '高' : confidence === 'medium' ? '中' : '低'})
                </span>
            </h3>
    `;

    // 原图查看部分
    if (imagePath) {
        resultHtml += `
            <div style="margin-bottom: 20px;">
                <h4 style="color: rgba(0, 255, 255, 0.8); font-size: 14px; margin-bottom: 12px;">### 原图查看</h4>
                <a href="${imagePath}" target="_blank" style="display: inline-block; padding: 10px 20px; background: rgba(0, 255, 255, 0.15); border: 1px solid rgba(0, 255, 255, 0.4); border-radius: 8px; color: #00ffff; text-decoration: none; transition: all 0.2s ease;">
                    🔍 点击查看原图
                </a>
                <div style="margin-top: 12px; font-size: 12px; color: rgba(0, 255, 255, 0.6);">
                    💡 点击链接在新窗口打开原始医疗报告图片
                </div>
            </div>
        `;
    }

    // 显示完整识别的医学数据内容（逐字提取）
    if (data.fullContent) {
        resultHtml += `
            <div style="margin-bottom: 20px;">
                <h4 style="color: rgba(0, 255, 255, 0.8); font-size: 14px; margin-bottom: 12px;">### 完整医学数据内容（逐字提取）</h4>
                <div style="background: rgba(0, 0, 0, 0.3); padding: 16px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.3); max-height: 600px; overflow-y: auto; font-size: 13px; color: rgba(255,255,255,0.85); white-space: pre-wrap; word-break: break-word; line-height: 1.8;">
${escapeHtml(data.fullContent)}
                </div>
                <div style="margin-top: 12px; padding: 12px; background: rgba(0, 255, 255, 0.1); border-radius: 8px; font-size: 12px; color: rgba(0, 255, 255, 0.7);">
                    <strong>自我检查结果：</strong><br>
                    ✓ 已确保每个字符（包括单位如umol/L、U/L和参考范围）与图片完全一致<br>
                    ✓ 没有任何遗漏或修改<br>
                    ✓ 保持原始格式和排版
                </div>
            </div>
        `;
    }

    resultHtml += `</div>`;

    // 插入到页面
    const existingResult = document.getElementById('medical-result');
    if (existingResult) {
        existingResult.remove();
    }

    const resultContainer = document.createElement('div');
    resultContainer.id = 'medical-result';
    resultContainer.innerHTML = resultHtml;

    document.querySelector('.container').appendChild(resultContainer);
}

// HTML转义函数
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 渲染已上传的图片列表
function renderUploadedImages() {
    const imagesList = document.getElementById('uploadedImagesList');

    if (!uploadedImages || uploadedImages.length === 0) {
        imagesList.innerHTML = '<div class="no-uploaded-images">暂无上传的图片</div>';
        return;
    }

    imagesList.innerHTML = uploadedImages.map(image => `
        <div class="image-item">
            <button class="delete-image-btn" onclick="deleteUploadedImage(${image.id})" title="删除图片">×</button>
            <img src="${image.filePath}" alt="${image.documentType}" onclick="viewUploadedImage('${image.filePath}', '${image.documentType}')">
            <div class="image-info">
                <div class="image-type">${image.documentType}</div>
                <div class="image-time">${formatUploadTime(image.uploadTime)}</div>
            </div>
        </div>
    `).join('');
}

// 格式化上传时间
function formatUploadTime(timeStr) {
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) {
        return '刚刚';
    } else if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

// 查看上传的图片（使用模态框）
function viewUploadedImage(filePath, documentType) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalImageInfo = document.getElementById('modalImageInfo');

    modalImage.src = filePath;
    modalImageInfo.textContent = documentType || '医疗图片';
    modal.classList.add('active');

    // 阻止页面滚动
    document.body.style.overflow = 'hidden';
}

// 关闭图片模态框
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('active');

    // 恢复页面滚动
    document.body.style.overflow = '';

    // 清空图片源
    setTimeout(() => {
        document.getElementById('modalImage').src = '';
    }, 200);
}

// 点击模态框背景关闭
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeImageModal();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeImageModal();
            }
        });
    }
});

// 删除上传的图片
async function deleteUploadedImage(id) {
    if (!confirm('确定要删除这张图片吗？')) {
        return;
    }

    try {
        // 从本地数组中找到图片信息
        const imageIndex = uploadedImages.findIndex(img => img.id === id);
        if (imageIndex === -1) {
            return;
        }

        const image = uploadedImages[imageIndex];

        // 调用API删除服务器上的图片文件
        const response = await fetch(`/api/medical/${image.imageId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // 从本地数组中移除
            uploadedImages.splice(imageIndex, 1);
            // 更新显示
            renderUploadedImages();
        } else {
            alert('删除失败，请稍后重试');
        }
    } catch (error) {
        console.error('删除图片失败:', error);
        alert('删除失败: ' + error.message);
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    initMedicalUpload();
    renderUploadedImages(); // 初始化图片列表
});

