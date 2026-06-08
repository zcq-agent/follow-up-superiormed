let clients = [];
let remindedClients = {};

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

function renderClients() {
    const list = document.getElementById('clientList');

    if (clients.length === 0) {
        list.innerHTML = '<div class="empty">暂无客户记录</div>';
        return;
    }

    list.innerHTML = clients
        .sort((a, b) => new Date(a.reminderTime) - new Date(b.reminderTime))
        .map((client) => {
            const reminderTime = new Date(client.reminderTime);
            const now = new Date();
            const isOverdue = reminderTime < now;
            const reminded = client.notified;
            return `
                <div class="client-item ${isOverdue ? 'overdue' : ''}">
                    <div class="client-name">
                        <span class="client-name-link" onclick="viewClientDetail('${encodeURIComponent(client.name)}')">${client.name}</span>
                    </div>
                    <div class="client-detail">干预项目：${client.intervention}</div>
                    ${client.notes ? `<div class="client-notes">注意事项：${client.notes}</div>` : ''}
                    <div class="client-time">
                        干预时间：${formatTime(client.interventionTime)}<br>
                        提醒时间：${formatTime(client.reminderTime)}
                        ${reminded ? ' <span style="color:#E63946;">(已通知)</span>' : ''}
                    </div>
                    <div class="client-actions">
                        <button class="delete" onclick="deleteClient(${client.id})">删除</button>
                    </div>
                </div>
            `;
        }).join('');
}

document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const client = {
        name: document.getElementById('name').value,
        intervention: document.getElementById('intervention').value,
        interventionTime: document.getElementById('interventionTime').value,
        reminderTime: document.getElementById('reminderTime').value,
        notes: document.getElementById('notes').value || ''
    };

    try {
        const response = await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(client)
        });
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        const result = await response.json();
        if (result.success) {
            await loadClients();
            e.target.reset();
            showStatus('添加成功');
        }
    } catch (error) {
        console.error('添加失败:', error);
        showStatus('添加失败: ' + error.message);
    }
});

async function deleteClient(id) {
    if (confirm('确定删除？')) {
        try {
            const response = await fetch(`/api/clients/${id}`, {
                method: 'DELETE'
            });
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            const result = await response.json();
            if (result.success) {
                await loadClients();
                showStatus('已删除');
            }
        } catch (error) {
            console.error('删除失败:', error);
        }
    }
}

function viewClientDetail(name) {
    window.location.href = `detail.html?name=${name}`;
}

function showStatus(message) {
    const status = document.getElementById('status');
    status.textContent = message;
    setTimeout(() => status.textContent = '', 2000);
}

async function loadClients() {
    try {
        const response = await fetch('/api/clients');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        clients = await response.json();
        renderClients();
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

document.getElementById('testWxNotify').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/test');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        const result = await response.json();
        showStatus(result.success ? '测试成功，请查收微信' : '发送失败');
    } catch (error) {
        console.error('测试失败:', error);
        showStatus('发送失败');
    }
});

loadClients();
setInterval(loadClients, 30000);
