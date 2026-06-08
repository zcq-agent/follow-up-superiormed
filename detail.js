let clients = [];

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

    pageTitle.textContent = `${clientName} - 干预记录`;

    const clientRecords = clients
        .map((client) => ({ client }))
        .filter(item => item.client.name === clientName);

    recordCount.textContent = `共 ${clientRecords.length} 条干预记录`;

    if (clientRecords.length === 0) {
        recordList.innerHTML = '<div class="no-records">暂无记录</div>';
        return;
    }

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

loadClients().then(() => {
    renderClientSelector();
});
