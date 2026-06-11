let clients = [];
let selectedClientId = null;
let selectedClientName = null;

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function formatTime(timeStr) {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function loadClients() {
    try {
        const response = await fetch('/api/clients');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        clients = await response.json();
    } catch (error) {
        console.error('加载数据失败:', error);
        clients = [];
    }
}

function getUniqueClients() {
    const nameMap = new Map();
    clients.forEach((client) => {
        if (!nameMap.has(client.name)) {
            nameMap.set(client.name, []);
        }
        nameMap.get(client.name).push({ client });
    });
    return nameMap;
}

function renderClientSelector() {
    const select = document.getElementById('clientSelect');
    const uniqueClients = getUniqueClients();

    if (uniqueClients.size === 0) {
        select.innerHTML = '<option>暂无客户</option>';
        return;
    }

    let options = '';
    uniqueClients.forEach((records, name) => {
        const count = records.length;
        options += `<option value="${name}">${name} (${count}条记录)</option>`;
    });

    select.innerHTML = options;

    const urlName = decodeURIComponent(getQueryParam('name') || '');
    if (urlName && uniqueClients.has(urlName)) {
        select.value = urlName;
    }

    select.addEventListener('change', () => {
        renderClientRecords(select.value);
    });

    renderClientRecords(select.value);
}

function renderClientRecords(clientName) {
    const recordList = document.getElementById('recordList');
    const recordCount = document.getElementById('recordCount');
    const pageTitle = document.getElementById('pageTitle');
    const imagesGrid = document.getElementById('imagesGrid');

    selectedClientName = clientName;

    // 找到对应的客户ID（取第一个匹配的客户记录）
    const firstClient = clients.find(c => c.name === clientName);
    selectedClientId = firstClient ? firstClient.id : null;

    pageTitle.textContent = `${clientName} - 干预记录`;

    const clientRecords = clients
        .map((client) => ({ client }))
        .filter(item => item.client.name === clientName);

    recordCount.textContent = `共 ${clientRecords.length} 条干预记录`;

    if (clientRecords.length === 0) {
        recordList.innerHTML = '<div class="no-records">暂无记录</div>';
    } else {
        recordList.innerHTML = clientRecords
            .sort((a, b) => new Date(a.client.reminderTime) - new Date(b.client.reminderTime))
            .map(item => {
                const { client } = item;
                const reminderTime = new Date(client.reminderTime);
                const now = new Date();
                const reminded = client.notified;

                let status, statusClass;
                if (reminded) {
                    status = '已通知';
                    statusClass = 'status-done';
                } else if (reminderTime < now) {
                    status = '待通知';
                    statusClass = 'status-overdue';
                } else {
                    status = '待随访';
                    statusClass = 'status-pending';
                }

                return `
                    <div class="record-item">
                        <div class="record-header">
                            <div class="record-title">${client.intervention}</div>
                            <span class="record-status ${statusClass}">${status}</span>
                        </div>
                        <div class="record-info">
                            干预时间：${formatTime(client.interventionTime)}<br>
                            提醒时间：${formatTime(client.reminderTime)}
                        </div>
                        ${client.notes ? `
                            <div class="record-notes">
                                <div class="label">注意事项</div>
                                <div class="content">${client.notes}</div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
    }

    // 加载并显示客户的图片
    loadClientImages();
}

// 加载客户图片
async function loadClientImages() {
    const imagesGrid = document.getElementById('imagesGrid');

    if (!selectedClientId) {
        imagesGrid.innerHTML = '<div class="no-images">请先选择客户</div>';
        return;
    }

    try {
        const response = await fetch(`/api/clients/${selectedClientId}/images`);
        const data = await response.json();

        if (!data.success || !data.images || data.images.length === 0) {
            imagesGrid.innerHTML = '<div class="no-images">暂无医疗图片</div>';
            return;
        }

        imagesGrid.innerHTML = data.images.map(image => `
            <div class="image-card">
                <img src="${image.filePath}" alt="${image.documentType}" class="image-preview" onclick="viewImage('${image.filePath}')">
                <div class="image-info">
                    <div class="image-type">${image.documentType}</div>
                    <div class="image-time">${formatTime(image.uploadTime)}</div>
                    <div class="image-actions">
                        <button class="action-btn view-btn" onclick="viewImage('${image.filePath}')">查看</button>
                        <button class="action-btn delete-btn" onclick="deleteImage(${image.id})">删除</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载图片失败:', error);
        imagesGrid.innerHTML = '<div class="no-images">加载失败</div>';
    }
}

loadClients().then(() => {
    renderClientSelector();
});

// ========== 图片管理功能 ==========

// 打开上传模态框
function openUploadModal() {
    if (!selectedClientId) {
        alert('请先选择客户');
        return;
    }
    document.getElementById('uploadModal').classList.add('active');
}

// 关闭上传模态框
function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
    document.getElementById('imageInput').value = '';
    document.getElementById('confirmUploadBtn').disabled = true;
}

// 文件选择变化
document.getElementById('imageInput')?.addEventListener('change', function() {
    const btn = document.getElementById('confirmUploadBtn');
    btn.disabled = !this.files || this.files.length === 0;
});

// 确认上传
async function confirmUpload() {
    const imageInput = document.getElementById('imageInput');
    const documentType = document.getElementById('documentType').value;
    const btn = document.getElementById('confirmUploadBtn');

    if (!imageInput.files || imageInput.files.length === 0) {
        alert('请选择图片');
        return;
    }

    const file = imageInput.files[0];

    // 检查文件大小
    if (file.size > 10 * 1024 * 1024) {
        alert('图片大小不能超过10MB');
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = '上传中...';

        // 1. 上传图片
        const formData = new FormData();
        formData.append('image', file);

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

        btn.textContent = '识别中...';

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

        // 3. 关联图片到客户
        const linkResponse = await fetch(`/api/clients/${selectedClientId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageId: uploadData.imageId,
                documentType: documentType,
                imageData: extractData.data
            })
        });

        if (!linkResponse.ok) {
            throw new Error('关联图片失败');
        }

        const linkData = await linkResponse.json();
        if (!linkData.success) {
            throw new Error(linkData.message || '关联图片失败');
        }

        // 4. 显示识别结果
        showExtractionResult(extractData.data, extractData.confidence);

        // 5. 刷新图片列表
        loadClientImages();

        // 6. 关闭模态框
        closeUploadModal();

    } catch (error) {
        console.error('上传/识别错误:', error);
        alert('操作失败: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '上传并识别';
    }
}

// 显示识别结果
function showExtractionResult(data, confidence) {
    // 创建结果展示区域
    const resultDiv = document.createElement('div');
    resultDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(20, 20, 30, 0.95); border: 1px solid rgba(0, 255, 255, 0.3); border-radius: 16px; padding: 24px; max-width: 600px; max-height: 80vh; overflow-y: auto; z-index: 2000; color: #fff;';

    const confidenceText = confidence === 'high' ? '高' : confidence === 'medium' ? '中' : '低';
    const content = data.fullContent || JSON.stringify(data, null, 2);

    resultDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="color: #00ffff; margin: 0;">📋 医学数据识别结果</h3>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 24px; cursor: pointer;">×</button>
        </div>
        <div style="margin-bottom: 16px; font-size: 12px; color: rgba(0, 255, 255, 0.6);">
            文档类型: ${data.type || '未知'} | 置信度: ${confidenceText}
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 16px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.3); font-size: 13px; white-space: pre-wrap; word-break: break-word; line-height: 1.8; max-height: 400px; overflow-y: auto;">
${escapeHtml(content)}
        </div>
        <div style="margin-top: 12px; font-size: 11px; color: rgba(0, 255, 255, 0.5);">
            💡 上述为图片中识别的完整医学数据内容
        </div>
    `;

    // 添加背景遮罩
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); z-index: 1999;';
    overlay.onclick = () => {
        overlay.remove();
        resultDiv.remove();
    };

    document.body.appendChild(overlay);
    document.body.appendChild(resultDiv);
}

// HTML转义函数
function escapeHtml(text) {
    if (typeof text !== 'string') {
        text = JSON.stringify(text, null, 2);
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

// 查看图片
function viewImage(filePath) {
    window.open(filePath, '_blank');
}

// 删除图片
async function deleteImage(imageId) {
    if (!confirm('确定要删除这张图片吗？删除后无法恢复。')) {
        return;
    }

    try {
        const response = await fetch(`/api/clients/${selectedClientId}/images/${imageId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || '删除失败');
        }

        // 刷新图片列表
        loadClientImages();
    } catch (error) {
        console.error('删除图片失败:', error);
        alert('删除失败: ' + error.message);
    }
}
