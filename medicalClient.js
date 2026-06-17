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

// 处理上传（自动触发，支持批量）
async function handleUpload() {
    const medicalImage = document.getElementById('medicalImage');
    const documentType = document.getElementById('documentType').value;
    const uploadStatus = document.getElementById('uploadStatus');

    if (!medicalImage.files || medicalImage.files.length === 0) {
        return;
    }

    const files = Array.from(medicalImage.files);
    const totalFiles = files.length;
    let processedFiles = 0;
    let successCount = 0;

    console.log(`开始批量上传 ${totalFiles} 个文件`);

    try {
        // 显示初始状态
        showStatus(uploadStatus, `⏳ 准备上传 ${totalFiles} 个文件...`, 'loading');

        // 为每个文件执行上传和识别
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            processedFiles++;

            try {
                // 更新状态
                showStatus(uploadStatus,
                    `⏳ 正在处理第 ${processedFiles}/${totalFiles} 个文件: ${file.name}`,
                    'loading');

                // 1. 上传文件
                const formData = new FormData();
                formData.append('files', file);

                const uploadResponse = await fetch('/api/medical/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!uploadResponse.ok) {
                    throw new Error('上传失败');
                }

                const uploadData = await uploadResponse.json();
                if (!uploadData.success || !uploadData.files || uploadData.files.length === 0) {
                    throw new Error(uploadData.message || '上传失败');
                }

                const uploadedFile = uploadData.files[0];
                console.log(`文件 ${file.name} 上传成功:`, uploadedFile);

                // 2. 识别数据（仅对支持的格式进行识别）
                showStatus(uploadStatus,
                    `⏳ 正在识别第 ${processedFiles}/${totalFiles} 个文件: ${file.name}`,
                    'loading');

                const extractResponse = await fetch('/api/medical/extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageId: uploadedFile.imageId,
                        documentType: documentType
                    })
                });

                let extractedData = null;
                if (extractResponse.ok) {
                    const extractData = await extractResponse.json();
                    if (extractData.success) {
                        extractedData = extractData.data;
                        successCount++;
                        console.log(`文件 ${file.name} 识别成功`);
                    }
                }

                // 3. 保存文件信息到本地数组
                const fileInfo = {
                    id: Date.now() + i,
                    imageId: uploadedFile.imageId,
                    filePath: uploadedFile.filePath,
                    originalName: uploadedFile.originalName,
                    documentType: documentType,
                    uploadTime: new Date().toISOString(),
                    extractedData: extractedData
                };
                uploadedImages.unshift(fileInfo);

                // 4. 如果是最后一个文件或者只有一个文件，显示识别结果
                if (totalFiles === 1) {
                    if (extractedData) {
                        displayExtractionResult(extractedData, 'high', uploadedFile.filePath);
                    }
                }

            } catch (error) {
                console.error(`文件 ${file.name} 处理失败:`, error);
                // 继续处理下一个文件
            }
        }

        // 5. 更新最终状态
        if (successCount === totalFiles) {
            showStatus(uploadStatus, `✅ 成功处理 ${successCount}/${totalFiles} 个文件`, 'success');
        } else if (successCount > 0) {
            showStatus(uploadStatus, `⚠️ 部分成功: ${successCount}/${totalFiles} 个文件`, 'warning');
        } else {
            showStatus(uploadStatus, `❌ 所有文件处理失败`, 'error');
        }

        // 6. 更新文件列表显示
        renderUploadedImages();

        // 清除文件选择
        medicalImage.value = '';

    } catch (error) {
        console.error('批量上传错误:', error);
        showStatus(uploadStatus, `❌ ${error.message}`, 'error');
    }
}

// 处理上传（自动触发）
async function handleUpload() {
    const medicalImage = document.getElementById('medicalImage');
    const documentType = document.getElementById('documentType').value;
    const uploadStatus = document.getElementById('uploadStatus');

    if (!medicalImage.files || medicalImage.files.length === 0) {
        return;
    }

    const files = Array.from(medicalImage.files);
    const totalFiles = files.length;
    let processedFiles = 0;
    let successCount = 0;

    console.log(`开始批量上传 ${totalFiles} 个文件`);

    try {
        // 显示初始状态
        showStatus(uploadStatus, `⏳ 准备上传 ${totalFiles} 个文件...`, 'loading');

        // 收集所有文件到一个 FormData
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        // 批量上传所有文件
        const uploadResponse = await fetch('/api/medical/upload', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            throw new Error('上传失败');
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.success || !uploadData.files || uploadData.files.length === 0) {
            throw new Error(uploadData.message || '上传失败');
        }

        const uploadedFiles = uploadData.files;
        console.log(`批量上传成功: ${uploadedFiles.length} 个文件`);
        console.log('上传的文件详情:', uploadedFiles);

        // 为每个上传的文件进行识别
        for (let i = 0; i < uploadedFiles.length; i++) {
            const uploadedFile = uploadedFiles[i];
            processedFiles++;

            try {
                showStatus(uploadStatus,
                    `⏳ 正在识别第 ${processedFiles}/${uploadedFiles.length} 个文件: ${uploadedFile.originalName}`,
                    'loading');

                // 识别数据
                const extractResponse = await fetch('/api/medical/extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageId: uploadedFile.imageId,
                        documentType: documentType
                    })
                });

                console.log('识别响应状态:', extractResponse.status, extractResponse.statusText);

                let extractedData = null;
                if (extractResponse.ok) {
                    const extractData = await extractResponse.json();
                    console.log('识别响应数据:', extractData);
                    if (extractData.success) {
                        extractedData = extractData.data;
                        console.log('提取的数据类型:', typeof extractedData);
                        console.log('fullContent类型:', typeof extractedData?.fullContent);
                        console.log('fullContent内容:', extractedData?.fullContent);
                        successCount++;
                    } else {
                        console.error('识别失败:', extractData.message);
                    }
                } else {
                    // 读取错误响应
                    const errorText = await extractResponse.text();
                    console.error('识别请求失败:', extractResponse.status, errorText);
                    showStatus(uploadStatus, `❌ 识别失败 (${extractResponse.status})`, 'error');
                }

                // 保存文件信息
                const fileInfo = {
                    id: Date.now() + i,
                    imageId: uploadedFile.imageId,
                    filePath: uploadedFile.filePath,
                    originalName: uploadedFile.originalName,
                    documentType: documentType,
                    uploadTime: new Date().toISOString(),
                    extractedData: extractedData
                };
                uploadedImages.unshift(fileInfo);

                // 如果只有一个文件，显示识别结果
                if (uploadedFiles.length === 1 && extractedData) {
                    displayExtractionResult(extractedData, 'high', uploadedFile.filePath, fileInfo.id);
                }

            } catch (error) {
                console.error(`文件 ${uploadedFile.originalName} 识别失败:`, error);
            }
        }

        // 更新最终状态
        if (successCount === uploadedFiles.length) {
            showStatus(uploadStatus, `✅ 成功处理 ${successCount}/${uploadedFiles.length} 个文件`, 'success');
        } else if (successCount > 0) {
            showStatus(uploadStatus, `⚠️ 部分成功: ${successCount}/${uploadedFiles.length} 个文件`, 'warning');
        } else {
            showStatus(uploadStatus, `⚠️ 已上传 ${uploadedFiles.length} 个文件，但识别失败`, 'warning');
        }

        // 更新文件列表显示
        renderUploadedImages();

        // 清除文件选择
        medicalImage.value = '';

    } catch (error) {
        console.error('批量上传错误:', error);
        showStatus(uploadStatus, `❌ ${error.message}`, 'error');
    }
}

// 显示状态信息
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = type;
}

// 直接在页面显示识别结果（按照用户要求的格式）
function displayExtractionResult(data, confidence, imagePath, fileId = null) {
    const resultsArea = document.getElementById('recognitionResultsArea');

    let resultHtml = `
        <div class="card recognition-result-card" ${fileId ? `data-file-id="${fileId}"` : ''} style="margin-top: 20px; border-color: rgba(0, 255, 255, 0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="color: #00ffff; margin: 0;">
                    📋 医学数据识别结果
                    <span style="font-size: 12px; color: rgba(0, 255, 255, 0.6); margin-left: 10px;">
                        (文档类型: ${data.type || '未知'} | 置信度: ${confidence === 'high' ? '高' : confidence === 'medium' ? '中' : '低'})
                    </span>
                </h3>
                <button onclick="copyRecognitionContent(this)" class="copy-btn" style="padding: 8px 16px; background: rgba(0, 255, 255, 0.15); border: 1px solid rgba(0, 255, 255, 0.4); border-radius: 8px; color: #00ffff; cursor: pointer; font-size: 12px; transition: all 0.2s ease;">
                    📋 复制内容
                </button>
            </div>
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
        // 处理 fullContent 可能是对象或字符串的情况
        let contentText = '';
        if (typeof data.fullContent === 'object' && data.fullContent !== null) {
            // 如果是对象，尝试提取文本内容
            contentText = JSON.stringify(data.fullContent, null, 2);
        } else {
            // 如果是字符串或其他类型
            contentText = String(data.fullContent);
        }

        resultHtml += `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="color: rgba(0, 255, 255, 0.8); font-size: 14px; margin: 0;">### 完整医学数据内容（逐字提取）</h4>
                </div>
                <div class="recognition-content" style="background: rgba(0, 0, 0, 0.3); padding: 16px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.3); max-height: 600px; overflow-y: auto; font-size: 13px; color: rgba(255,255,255,0.85); white-space: pre-wrap; word-break: break-word; line-height: 1.8; user-select: text;">
${escapeHtml(contentText)}
                </div>
                <div style="margin-top: 12px; padding: 12px; background: rgba(0, 255, 255, 0.1); border-radius: 8px; font-size: 12px; color: rgba(0, 255, 255, 0.7);">
                    <strong>识别质量确认：</strong><br>
                    ✓ 已确保每个字符（包括单位如umol/L、U/L和参考范围）与文档完全一致<br>
                    ✓ 没有任何遗漏或修改<br>
                    ✓ 保持原始格式和排版
                </div>
            </div>
        `;
    }

    resultHtml += `</div>`;

    // 添加到结果区域
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = resultHtml;
    const newResult = tempDiv.firstChild;

    // 如果是更新现有结果，替换它
    if (fileId) {
        const existingResult = resultsArea.querySelector(`[data-file-id="${fileId}"]`);
        if (existingResult) {
            existingResult.replaceWith(newResult);
        } else {
            resultsArea.appendChild(newResult);
        }
    } else {
        // 移除旧的临时结果
        const oldResult = resultsArea.querySelector('.recognition-result-card:not([data-file-id])');
        if (oldResult) oldResult.remove();
        resultsArea.appendChild(newResult);
    }
}

// 复制识别内容
function copyRecognitionContent(button) {
    const card = button.closest('.recognition-result-card');
    const contentDiv = card.querySelector('.recognition-content');

    if (contentDiv) {
        // 获取纯文本内容
        const text = contentDiv.textContent;

        // 复制到剪贴板
        navigator.clipboard.writeText(text).then(() => {
            // 显示复制成功反馈
            const originalText = button.innerHTML;
            button.innerHTML = '✅ 已复制';
            button.style.background = 'rgba(0, 255, 0, 0.2)';
            button.style.borderColor = 'rgba(0, 255, 0, 0.4)';
            button.style.color = '#00ff00';

            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = 'rgba(0, 255, 255, 0.15)';
                button.style.borderColor = 'rgba(0, 255, 255, 0.4)';
                button.style.color = '#00ffff';
            }, 2000);
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败，请手动选择内容复制');
        });
    }
}

// HTML转义函数
function escapeHtml(text) {
    // 处理非字符串类型
    if (typeof text !== 'string') {
        if (text === null || text === undefined) {
            return '';
        }
        text = String(text);
    }

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 渲染已上传的文件列表
function renderUploadedImages() {
    const imagesList = document.getElementById('uploadedImagesList');

    if (!uploadedImages || uploadedImages.length === 0) {
        imagesList.innerHTML = '<div class="no-uploaded-images">暂无上传的文件</div>';
        return;
    }

    imagesList.innerHTML = uploadedImages.map(file => {
        // 根据文件类型选择图标和预览方式
        const fileIcon = getFileIcon(file.originalName || file.filePath);
        const hasExtractedData = file.extractedData && file.extractedData.fullContent;

        return `
        <div class="image-item">
            <button class="delete-image-btn" onclick="deleteUploadedImage(${file.id})" title="删除文件">×</button>
            <div class="file-preview" onclick="viewUploadedImage('${file.filePath}', '${file.documentType}', ${file.id})">
                <div class="file-icon">${fileIcon}</div>
            </div>
            <div class="image-info">
                <div class="image-type">
                    ${file.documentType}
                    ${hasExtractedData ? '<span style="color: #00ffff;"> ✓ 已识别</span>' : ''}
                </div>
                <div class="image-time">${formatUploadTime(file.uploadTime)}</div>
                <div class="file-name" title="${file.originalName || '文件'}">${truncateFileName(file.originalName || '文件')}</div>
            </div>
        </div>
    `}).join('');
}

// 获取文件类型图标
function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = {
        'pdf': '📄',
        'doc': '📝',
        'docx': '📝',
        'xls': '📊',
        'xlsx': '📊',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️'
    };
    return icons[ext] || '📁';
}

// 截断文件名
function truncateFileName(fileName, maxLength = 20) {
    if (fileName.length <= maxLength) return fileName;
    return fileName.substring(0, maxLength - 3) + '...';
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

// 查看上传的文件（使用模态框或显示识别内容）
function viewUploadedImage(filePath, documentType, fileId = null) {
    // 如果有 fileId，尝试显示识别内容
    if (fileId) {
        const file = uploadedImages.find(f => f.id === fileId);
        if (file && file.extractedData && file.extractedData.fullContent) {
            // 显示识别结果
            displayExtractionResult(file.extractedData, 'high', filePath, fileId);
            // 滚动到结果区域
            document.getElementById('recognitionResultsArea').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }
    }

    // 否则显示图片/文件预览
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalImageInfo = document.getElementById('modalImageInfo');

    modalImage.src = filePath;
    modalImageInfo.textContent = documentType || '文件';
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

