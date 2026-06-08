let vips = [];
let editIndex = -1;

async function loadVips() {
    try {
        const response = await fetch('/api/vips');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        vips = await response.json();
        renderVips();
    } catch (error) {
        console.error('加载VIP失败:', error);
        vips = [];
        renderVips();
    }
}

function renderVips() {
    const list = document.getElementById('vipList');

    if (vips.length === 0) {
        list.innerHTML = '<div class="empty">暂无大客户记录</div>';
        return;
    }

    list.innerHTML = vips.map((vip) => {
        const timelineLines = vip.timeline.split('\n').filter(line => line.trim());
        const indicators = vip.indicators.split('\n').filter(line => line.trim());

        return `
            <div class="client-item">
                <div class="client-name">${vip.name}</div>

                ${timelineLines.length > 0 ? `
                    <div style="margin-top: 16px;">
                        <div class="client-detail">治疗时间线</div>
                        ${timelineLines.map(line => {
                            const match = line.match(/^(\d{4}-\d{1,2}-\d{1,2}.*?)[:：](.*)$/);
                            if (match) {
                                return `
                                    <div class="timeline-item">
                                        <div class="timeline-date">${match[1]}</div>
                                        <div class="timeline-content">${match[2]}</div>
                                    </div>
                                `;
                            }
                            return `<div class="timeline-content" style="margin-bottom: 8px;">${line}</div>`;
                        }).join('')}
                    </div>
                ` : ''}

                ${indicators.length > 0 ? `
                    <div style="margin-top: 16px;">
                        <div class="client-detail">主要检测阳性指标</div>
                        <div style="margin-top: 8px;">
                            ${indicators.map(ind => `<span class="indicator-tag">${ind}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${vip.notes ? `
                    <div class="client-notes" style="margin-top: 16px;">
                        注意事项：${vip.notes}
                    </div>
                ` : ''}

                <div class="client-actions">
                    <button class="edit-btn" onclick="editVip(${vip.id})">编辑</button>
                    <button class="delete" onclick="deleteVip(${vip.id})">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

document.getElementById('vipForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const vip = {
        name: document.getElementById('vipName').value,
        timeline: document.getElementById('vipTimeline').value,
        indicators: document.getElementById('vipIndicators').value,
        notes: document.getElementById('vipNotes').value
    };

    try {
        const response = await fetch('/api/vips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vip)
        });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        const result = await response.json();
        if (result.success) {
            await loadVips();
            e.target.reset();
            showStatus('添加成功');
        }
    } catch (error) {
        console.error('添加失败:', error);
        showStatus('添加失败');
    }
});

function editVip(id) {
    const vip = vips.find(v => v.id === id);
    if (!vip) return;

    editIndex = id;
    document.getElementById('editName').value = vip.name;
    document.getElementById('editTimeline').value = vip.timeline;
    document.getElementById('editIndicators').value = vip.indicators;
    document.getElementById('editNotes').value = vip.notes;

    document.getElementById('editModal').classList.add('active');
}

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const vipData = {
        name: document.getElementById('editName').value,
        timeline: document.getElementById('editTimeline').value,
        indicators: document.getElementById('editIndicators').value,
        notes: document.getElementById('editNotes').value
    };

    try {
        const response = await fetch(`/api/vips/${editIndex}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vipData)
        });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        const result = await response.json();
        if (result.success) {
            await loadVips();
            closeModal();
            showStatus('保存成功');
        }
    } catch (error) {
        console.error('保存失败:', error);
        showStatus('保存失败');
    }
});

function closeModal() {
    document.getElementById('editModal').classList.remove('active');
    editIndex = -1;
}

async function deleteVip(id) {
    if (confirm('确定删除？')) {
        try {
            const response = await fetch(`/api/vips/${id}`, {
                method: 'DELETE'
            });
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            const result = await response.json();
            if (result.success) {
                await loadVips();
                showStatus('已删除');
            }
        } catch (error) {
            console.error('删除失败:', error);
        }
    }
}

function showStatus(message) {
    const status = document.createElement('div');
    status.className = 'status';
    status.textContent = message;
    document.body.appendChild(status);

    setTimeout(() => {
        status.style.opacity = '0';
        status.style.transition = 'opacity 0.3s';
        setTimeout(() => status.remove(), 300);
    }, 2000);
}

document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeModal();
    }
});

loadVips();
