import { jsonResponse } from './utils.js';

/**
 * Route: /api/claims
 * Handles GET (list/query), POST (insert/update), and DELETE (remove) for claims.
 */

// 1. GET: Fetch claims list (role-filtered)
export async function onRequestGet(context) {
    const { env, data } = context;
    const user = data.user;

    if (!user) {
        return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
    }

    if (!env.DB) {
        return jsonResponse({ error: 'Cloudflare D1 Database binding "DB" is missing.' }, 500);
    }

    try {
        let claims = [];
        if (user.role === 'admin') {
            // Admin sees all claims
            const { results } = await env.DB.prepare('SELECT * FROM claims ORDER BY createTime DESC').all();
            claims = results;
        } else {
            // User sees only claims matching their supplierCode
            const { results } = await env.DB.prepare('SELECT * FROM claims WHERE supplierCode = ? ORDER BY createTime DESC')
                .bind(user.supplierCode)
                .all();
            claims = results;
        }

        return jsonResponse(claims);
    } catch (e) {
        console.error('Error fetching claims', e);
        return jsonResponse({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + e.message }, 500);
    }
}

// 2. POST: Create or Update a claim (enforces field-level RBAC)
export async function onRequestPost(context) {
    const { request, env, data } = context;
    const user = data.user;

    if (!user) {
        return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
    }

    if (!env.DB) {
        return jsonResponse({ error: 'Cloudflare D1 Database binding "DB" is missing.' }, 500);
    }

    try {
        const claimData = await request.json();
        const claimId = claimData.claimId ? String(claimData.claimId).trim() : '';

        if (!claimId) {
            return jsonResponse({ error: 'เลขที่ใบเคลมเป็นข้อมูลที่จำเป็น' }, 400);
        }

        if (user.role === 'admin') {
            // Admin can write/edit all fields
            await env.DB.prepare(`
                INSERT OR REPLACE INTO claims (
                    claimId, receiveStatus, jobSupplier, claimResult, repairReady, remark, 
                    supplierCode, senderAddress, packingList, dhlBookingNo, returnDestination, 
                    returnDhlBookingNo, createTime, branchName, productCategory, productName, 
                    serialNumber, issueDescription, customerName, customerTel, imageUrl
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                claimId,
                claimData.receiveStatus || 'ยังไม่ได้รับ',
                claimData.jobSupplier || '',
                claimData.claimResult || 'เปลี่ยนตัวใหม่',
                claimData.repairReady || 'เสร็จแล้วรอ Book',
                claimData.remark || '',
                claimData.supplierCode || '',
                claimData.senderAddress || '',
                claimData.packingList || '',
                claimData.dhlBookingNo || '',
                claimData.returnDestination || '',
                claimData.returnDhlBookingNo || '',
                Number(claimData.createTime) || Date.now(),
                claimData.branchName || '',
                claimData.productCategory || '',
                claimData.productName || '',
                claimData.serialNumber || '',
                claimData.issueDescription || '',
                claimData.customerName || '',
                claimData.customerTel || '',
                claimData.imageUrl || ''
            ).run();

            return jsonResponse({ success: true, message: 'บันทึกข้อมูลใบเคลมเรียบร้อยแล้ว' });
        } else {
            // User Role: Enforce strict limits
            // 1. Fetch existing claim to verify ownership
            const existingClaim = await env.DB.prepare('SELECT * FROM claims WHERE claimId = ?')
                .bind(claimId)
                .first();

            if (!existingClaim) {
                return jsonResponse({ error: 'ไม่พบข้อมูลใบเคลมในระบบ (User ไม่มีสิทธิ์สร้างใบเคลมใหม่)' }, 404);
            }

            // 2. Verify user owns this claim matching their supplier code
            if (existingClaim.supplierCode !== user.supplierCode) {
                return jsonResponse({ error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลใบเคลมของ Supplier รายอื่น' }, 403);
            }

            // 3. Update ONLY the 5 allowed columns
            await env.DB.prepare(`
                UPDATE claims SET 
                    receiveStatus = ?, 
                    jobSupplier = ?, 
                    claimResult = ?, 
                    repairReady = ?, 
                    remark = ? 
                WHERE claimId = ?
            `).bind(
                claimData.receiveStatus || existingClaim.receiveStatus,
                claimData.jobSupplier !== undefined ? String(claimData.jobSupplier).trim() : existingClaim.jobSupplier,
                claimData.claimResult || existingClaim.claimResult,
                claimData.repairReady || existingClaim.repairReady,
                claimData.remark !== undefined ? String(claimData.remark).trim() : existingClaim.remark,
                claimId
            ).run();

            return jsonResponse({ success: true, message: 'อัพเดตสถานะงานเคลมเรียบร้อยแล้ว' });
        }
    } catch (e) {
        console.error('Error saving claim', e);
        return jsonResponse({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + e.message }, 500);
    }
}

// 3. DELETE: Remove a claim (Admin only)
export async function onRequestDelete(context) {
    const { request, env, data } = context;
    const user = data.user;

    if (!user) {
        return jsonResponse({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401);
    }

    if (user.role !== 'admin') {
        return jsonResponse({ error: 'คุณไม่มีสิทธิ์ลบข้อมูลงานเคลม (สิทธิ์เฉพาะ Admin)' }, 403);
    }

    if (!env.DB) {
        return jsonResponse({ error: 'Cloudflare D1 Database binding "DB" is missing.' }, 500);
    }

    try {
        const url = new URL(request.url);
        const claimId = url.searchParams.get('claimId');

        if (!claimId) {
            return jsonResponse({ error: 'กรุณาระบุเลขที่ใบเคลมที่ต้องการลบ' }, 400);
        }

        const result = await env.DB.prepare('DELETE FROM claims WHERE claimId = ?').bind(claimId).run();
        
        return jsonResponse({ success: true, message: 'ลบข้อมูลใบเคลมเรียบร้อยแล้ว' });
    } catch (e) {
        console.error('Error deleting claim', e);
        return jsonResponse({ error: 'เกิดข้อผิดพลาดในการลบข้อมูล: ' + e.message }, 500);
    }
}
