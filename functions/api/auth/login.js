import { jsonResponse, hashPassword, signJWT } from '../utils.js';

/**
 * Route: POST /api/auth/login
 * Validates credentials and returns JWT session token.
 */
export async function onRequestPost(context) {
    const { request, env } = context;
    
    // Check D1 DB Binding
    if (!env.DB) {
        return jsonResponse({ 
            error: 'Cloudflare D1 Database binding "DB" is missing. Please check D1 database bindings in Cloudflare Pages dashboard.' 
        }, 500);
    }

    try {
        const { username, password } = await request.json();
        
        if (!username || !password) {
            return jsonResponse({ error: 'กรุณากรอก Username และ Password' }, 400);
        }

        const normalizedUsername = username.trim().toLowerCase();

        // 1. Fetch user from D1 database
        const stmt = env.DB.prepare('SELECT * FROM users WHERE username = ?');
        let user = await stmt.bind(normalizedUsername).first();

        // 2. Auto-seed admin user if D1 database is completely empty
        if (!user && normalizedUsername === 'admin') {
            const countResult = await env.DB.prepare('SELECT count(*) as count FROM users').first();
            if (countResult && countResult.count === 0) {
                // No users exist at all, auto seed the admin account
                const defaultHash = await hashPassword('password');
                await env.DB.prepare('INSERT INTO users (username, password, role, supplierCode) VALUES (?, ?, ?, ?)')
                    .bind('admin', defaultHash, 'admin', '')
                    .run();
                
                // Fetch again
                user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind('admin').first();
                console.log('Seeded default admin account into D1.');
            }
        }

        if (!user) {
            return jsonResponse({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' }, 401);
        }

        // 3. Compare passwords
        const hashedInput = await hashPassword(password);
        if (user.password !== hashedInput) {
            return jsonResponse({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' }, 401);
        }

        // 4. Generate JWT payload
        const payload = {
            username: user.username,
            role: user.role,
            supplierCode: user.supplierCode || ''
        };

        const secret = env.JWT_SECRET || undefined;
        const token = await signJWT(payload, secret);

        return jsonResponse({
            success: true,
            user: payload,
            token: token
        });

    } catch (e) {
        console.error('Login error', e);
        return jsonResponse({ error: 'เกิดข้อผิดพลาดภายในระบบ: ' + e.message }, 500);
    }
}
