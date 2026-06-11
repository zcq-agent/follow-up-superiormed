#!/usr/bin/env node
// 测试医疗图片上传和识别流程

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const PASSWORD = 'zcq';

// 创建一个带 cookie 的 fetch 实例
const fetchWithCookie = (url, options = {}) => {
    const jar = global.__cookieJar || [];
    if (options.headers) {
        if (jar.length > 0) {
            options.headers['Cookie'] = jar.join('; ');
        }
    }
    return fetch(url, options).then(res => {
        // 保存 cookies
        const cookies = res.headers.raw()['set-cookie'];
        if (cookies) {
            cookies.forEach(cookie => {
                const match = cookie.match(/^([^=]+)=([^;]+)/);
                if (match) {
                    const existing = jar.findIndex(c => c.startsWith(match[1] + '='));
                    const cookieStr = match[0];
                    if (existing >= 0) {
                        jar[existing] = cookieStr;
                    } else {
                        jar.push(cookieStr);
                    }
                }
            });
            global.__cookieJar = jar;
        }
        return res;
    });
};

async function login() {
    console.log('=== Phase 0: 登录 ===');
    const res = await fetchWithCookie(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: PASSWORD })
    });
    const data = await res.json();
    console.log('登录结果:', data);
    return data.success;
}

async function testUpload() {
    console.log('=== Phase 1: 测试上传端点 ===');

    // 登录
    const loggedIn = await login();
    if (!loggedIn) {
        console.error('❌ 登录失败');
        return;
    }

    // 找一个测试图片
    const uploadsDir = path.join(__dirname, 'data/uploads');
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

    if (files.length === 0) {
        console.error('❌ 没有找到测试图片');
        return;
    }

    const testFile = files[0];
    const testPath = path.join(uploadsDir, testFile);
    console.log('📁 使用测试图片:', testFile);

    // 1. 测试上传
    console.log('\n=== Phase 2: 测试文件上传 ===');
    const form = new FormData();
    form.append('image', fs.createReadStream(testPath));

    try {
        const uploadRes = await fetchWithCookie(`${BASE_URL}/api/medical/upload`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        console.log('状态码:', uploadRes.status);
        const uploadData = await uploadRes.json();
        console.log('响应:', JSON.stringify(uploadData, null, 2));

        if (!uploadData.success) {
            console.error('❌ 上传失败');
            return;
        }

        // 2. 测试识别
        console.log('\n=== Phase 3: 测试OCR识别 ===');
        const extractRes = await fetchWithCookie(`${BASE_URL}/api/medical/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageId: uploadData.imageId,
                documentType: '血液检查'
            })
        });

        console.log('状态码:', extractRes.status);
        const extractData = await extractRes.json();
        console.log('响应:', JSON.stringify(extractData, null, 2));

        if (extractData.success) {
            console.log('\n✅ 测试成功！');
            console.log('识别内容:', extractData.data.fullContent);
        } else {
            console.error('❌ 识别失败:', extractData.message);
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

testUpload();
