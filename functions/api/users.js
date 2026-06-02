import { jsonResponse, hashPassword } from './utils.js';

/**
 * Route: /api/users
 * Handles user management actions (GET list, POST create, DELETE remove).
 * Access restricted to Admin accounts.
 */

// 1. GET: List all users (excluding hashed passwords)
export async function onRequestGet(context) {
    const { env, data } = context;
    const user = data.user;

    if (!user) {
        return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
    }

    if (user.role !== 'admin') {
        return jsonResponse({ error: 'ปฏิเสธการเข้าถึง (สิทธิ์เฉพาะ Admin)' }, 403);
    }

    if (!env.DB) {
        return jsonResponse({ error: 'Cloudflare D1 Database binding "DB" is missing.' }, 500);
    }

    try {
        const { results } = await env.DB.prepare('SELECT username, role, supplierCode FROM users ORDER BY username ASC').all();
        return jsonResponse(results);
    } catch (e) {
        console.error('Error fetching users', e);
        return jsonResponse({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้: ' + e.message }, 500);
    }
}

// 2. POST: Add a new user account
export async function onRequestPost(context) {
    const { request, env, data } = context;
    const user = data.user;

    if (!user) {
        return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
    }

    if (user.role !== 'admin') {
        return jsonResponse({ error: 'ปฏิเสธการเข้าถึง (สิทธิ์เฉพาะ Admin)' }, 403);
    }

    if (!env.DB) {
        return jsonResponse({ error: 'Cloudflare D1 Database binding "DB" is missing.' }, 500);
    }

    try {
        const { username, password, role, supplierCode } = await request.json();
        
        const cleanUsername = username ? String(username).trim().toLowerCase() : '';
        const cleanRole = role ? String(role).trim().toLowerCase() : 'user';
        const cleanSupplierCode = supplierCode ? String(supplierCode).trim() : '';

        if (!cleanUsername || !password) {
            return jsonResponse({ error: 'กรุณากรอก Username และ Password' }, 400);
        }

        if (password.length < 4) {
            return jsonResponse({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร' }, 400);
        }

        if (cleanRole === 'user' && !cleanSupplierCode) {
            return jsonResponse({ error: 'บัญชีบทบาท User (Supplier) จำเป็นต้องมีรหัส Supplier Code' }, 400);
        }

        // Check if user already exists
        const existing = await env.DB.prepare('SELECT username FROM users WHERE username = ?')
            .bind(cleanUsername)
            .first();

        if (existing) {
            return jsonResponse({ error: 'ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว' }, 400);
        }

        // Hash and insert
        const hashedPassword = await hashPassword(password);
        await env.DB.prepare('INSERT INTO users (username, password, role, supplierCode) VALUES (?, ?, ?, ?)')
            .bind(cleanUsername, hashedPassword, cleanRole, cleanRole === 'admin' ? '' : cleanSupplierCode)
            .run();

        return jsonResponse({ success: true, message: 'สร้างบัญชีผู้ใช้งานสำเร็จแล้ว' });
    } catch (e) {
        console.error('Error creating user', e);
        return jsonResponse({ error: 'เกิดข้อผิดพลาดในการสร้างบัญชีผู้ใช้: ' + e.message }, 500);
    }
}

// 3. DELETE: Remove a user account
export async function onRequestDelete(context) {
    const { request, env, data } = context;
    const user = data.user;

    if (!user) {
        return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
    }

    if (user.role !== 'admin') {
        return jsonResponse({ error: 'ปฏิเสธการเข้าถึง (สิทธิ์เฉพาะ Admin)' }, 403);
    }

    if (!env.DB) {
        return jsonResponse({ error: 'Cloudflare D1 Database binding "DB" is missing.' }, 500);
    }

    try {
        const url = new URL(request.url);
        const usernameToDelete = url.searchParams.get('username');

        if (!usernameToDelete) {
            return jsonResponse({ error: 'กรุณาระบุชื่อผู้ใช้งานที่ต้องการลบ' }, 400);
        }

        const normalizedDelete = usernameToDelete.trim().toLowerCase();

        // Prevent self-deletion or primary admin deletion
        if (normalizedDelete === 'admin') {
            return jsonResponse({ error: 'ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (admin) ได้' }, 400);
        }

        if (normalizedDelete === user.username.toLowerCase()) {
            return jsonResponse({ error: 'คุณไม่สามารถลบบัญชีที่กำลังล็อกอินใช้งานอยู่ได้' }, 400);
        }

        await env.DB.prepare('DELETE FROM users WHERE username = ?').bind(normalizedDelete).run();
        
        return jsonResponse({ success: true, message: 'ลบบัญชีผู้ใช้งานเรียบร้อยแล้ว' });
    } catch (e) {
        console.error('Error deleting user', e);
        return jsonResponse({ error: 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน: ' + e.message }, 500);
    }
}
