const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Session 配置
app.use(session({
    secret: process.env.SESSION_SECRET || 'followup-system-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24小时
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Server酱 SendKey（从环境变量读取）
const SEND_KEY = process.env.SEND_KEY;
// 登录密码（从环境变量读取，默认密码）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const VIPS_FILE = path.join(DATA_DIR, 'vips.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// 加载数据
function loadData() {
    try {
        if (fs.existsSync(CLIENTS_FILE)) {
            return JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
    return [];
}

// 保存数据
function saveData(clients) {
    try {
        fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// 加载VIP数据
function loadVips() {
    try {
        if (fs.existsSync(VIPS_FILE)) {
            return JSON.parse(fs.readFileSync(VIPS_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('加载VIP数据失败:', error);
    }
    return [];
}

// 保存VIP数据
function saveVips(vips) {
    try {
        fs.writeFileSync(VIPS_FILE, JSON.stringify(vips, null, 2));
    } catch (error) {
        console.error('保存VIP数据失败:', error);
    }
}

// 初始化数据
let clients = loadData();
let vips = loadVips();

// 认证中间件 - 保护需要登录的页面
function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: '未授权，请先登录' });
    }
}

// 认证中间件 - 保护页面访问（HTML页面）
function requireAuthPage(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// ========== 认证相关 API ==========

// 登录 API
app.post('/api/login', (req, res) => {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        req.session.loginTime = new Date().toISOString();
        res.json({
            success: true,
            message: '登录成功'
        });
    } else {
        res.status(401).json({
            success: false,
            message: '密码错误'
        });
    }
});

// 登出 API
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ success: false, message: '登出失败' });
        } else {
            res.json({ success: true, message: '登出成功' });
        }
    });
});

// 检查登录状态 API
app.get('/api/auth/status', (req, res) => {
    res.json({
        authenticated: !!req.session.authenticated,
        loginTime: req.session.loginTime || null
    });
});

// 修改密码 API（需要旧密码验证）
app.post('/api/auth/change-password', requireAuth, (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (oldPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: '原密码错误' });
    }

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: '新密码至少6位' });
    }

    // 注意：这里只是临时修改，重启后会恢复
    // 永久修改需要在环境变量中设置
    process.env.ADMIN_PASSWORD = newPassword;

    res.json({ success: true, message: '密码修改成功（当前会话有效）' });
});

// ========== 受保护的页面路由 ==========

// 保护主要页面
app.get('/index.html', requireAuthPage);
app.get('/vip.html', requireAuthPage);
app.get('/detail.html', requireAuthPage);

// ========== 数据 API（需要认证）==========

// API: 获取配置（SendKey）
app.get('/api/config', requireAuth, (req, res) => {
    res.json({ sendKey: SEND_KEY ? '***已配置***' : '' });
});

// API: 获取已提醒状态
app.get('/api/reminded', requireAuth, (req, res) => {
    const reminded = {};
    clients.forEach(client => {
        if (client.notified) {
            reminded[client.id] = true;
        }
    });
    res.json(reminded);
});

// API: 添加客户
app.post('/api/clients', requireAuth, (req, res) => {
    const client = req.body;
    client.id = Date.now();
    client.notified = false;
    clients.push(client);
    saveData(clients);
    res.json({ success: true, client });
});

// API: 获取客户列表
app.get('/api/clients', requireAuth, (req, res) => {
    res.json(clients);
});

// API: 删除客户
app.delete('/api/clients/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    clients = clients.filter(c => c.id !== id);
    saveData(clients);
    res.json({ success: true });
});

// API: VIP - 获取列表
app.get('/api/vips', requireAuth, (req, res) => {
    res.json(vips);
});

// API: VIP - 添加
app.post('/api/vips', requireAuth, (req, res) => {
    const vip = req.body;
    vip.id = Date.now();
    vips.push(vip);
    saveVips(vips);
    res.json({ success: true, vip });
});

// API: VIP - 更新
app.put('/api/vips/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const index = vips.findIndex(v => v.id === id);
    if (index !== -1) {
        vips[index] = { ...vips[index], ...req.body };
        saveVips(vips);
        res.json({ success: true, vip: vips[index] });
    } else {
        res.status(404).json({ success: false });
    }
});

// API: VIP - 删除
app.delete('/api/vips/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    vips = vips.filter(v => v.id !== id);
    saveVips(vips);
    res.json({ success: true });
});

// API: 测试通知
app.get('/api/test', requireAuth, async (req, res) => {
    const success = await sendWxNotify('测试通知', '功能医学随访提醒功能正常！');
    res.json({ success });
});

// ========== 其他功能 ==========

// 发送微信通知
async function sendWxNotify(title, content) {
    try {
        const fetch = require('node-fetch');
        const response = await fetch(`https://sctapi.ftqq.com/${SEND_KEY}.send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, desp: content })
        });
        const result = await response.json();
        return result.code === 0;
    } catch (error) {
        console.error('微信通知失败:', error);
        return false;
    }
}

// 格式化时间
function formatTime(date) {
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 检查提醒
function checkReminders() {
    const now = new Date();

    clients.forEach(client => {
        const reminderTime = new Date(client.reminderTime);

        // 检查是否到了提醒时间（前后1分钟内）
        const diff = Math.abs(reminderTime - now);
        if (diff < 60000 && !client.notified) {
            const content = `
客户：${client.name}
干预项目：${client.intervention}
干预时间：${formatTime(new Date(client.interventionTime))}
提醒时间：${formatTime(reminderTime)}

请及时进行随访。
            `.trim();

            sendWxNotify('🔔 随访提醒', content).then(success => {
                if (success) {
                    client.notified = true;
                    console.log(`已通知: ${client.name}`);
                }
            });
        }
    });
}

// 每分钟检查一次提醒
cron.schedule('* * * * *', () => {
    console.log('检查提醒...', new Date().toLocaleString('zh-CN'));
    checkReminders();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务运行在端口 ${PORT}`);
    console.log(`默认密码: ${ADMIN_PASSWORD} (请在环境变量中设置 ADMIN_PASSWORD 修改)`);
});
