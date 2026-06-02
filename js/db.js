/**
 * Database module using browser's IndexedDB for Claim Management System.
 * Safe, serverless, and stores rich media (images) as base64 without size limits.
 */

const DB_NAME = 'ClaimTrackingDB';
const DB_VERSION = 1;

let dbInstance = null;

// Helper to hash password using Web Crypto API (SHA-256)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Open and initialize database
function openDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database failed to open:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create claims store with claimId as key
            if (!db.objectStoreNames.contains('claims')) {
                db.createObjectStore('claims', { keyPath: 'claimId' });
            }

            // Create users store with username as key
            if (!db.objectStoreNames.contains('users')) {
                db.createObjectStore('users', { keyPath: 'username' });
            }
        };
    });
}

// Seed mock data if databases are empty
async function seedDatabase() {
    const db = await openDB();
    
    // Check and seed users
    const usersCount = await getCount('users');
    if (usersCount === 0) {
        const adminHash = await hashPassword('password');
        const user1Hash = await hashPassword('password');
        const user2Hash = await hashPassword('password');

        const defaultUsers = [
            { username: 'admin', password: adminHash, role: 'admin', supplierCode: '' },
            { username: 'banana_sup1', password: user1Hash, role: 'user', supplierCode: 'SUP001' },
            { username: 'banana_sup2', password: user2Hash, role: 'user', supplierCode: 'SUP002' }
        ];

        for (const user of defaultUsers) {
            await saveRecord('users', user);
        }
        console.log('Default users seeded.');
    }

    // Check and seed claims
    const claimsCount = await getCount('claims');
    if (claimsCount === 0) {
        const defaultClaims = [
            {
                claimId: 'CLM-2026-001',
                receiveStatus: 'ยังไม่ได้รับ',
                jobSupplier: 'SUP-JOB-991',
                claimResult: 'เปลี่ยนตัวใหม่',
                repairReady: 'เสร็จแล้วรอ Book',
                remark: 'รอดำเนินการขนส่งทดแทน',
                supplierCode: 'SUP001',
                senderAddress: 'Banana IT Rama 9 Road, Bangkok',
                packingList: 'PK-99212',
                dhlBookingNo: 'DHL-887711',
                returnDestination: 'หน้าร้าน สาขาเซ็นทรัลพระราม 9',
                returnDhlBookingNo: 'DHL-RT-11223',
                createTime: new Date('2026-06-01T09:00:00Z').getTime(),
                branchName: 'เซ็นทรัลพระราม 9',
                productCategory: 'Laptop',
                productName: 'Asus ROG Strix G16',
                serialNumber: 'SN-ASUS-9988221',
                issueDescription: 'หน้าจอเปิดไม่ติด ไฟคีย์บอร์ดกระพริบแต่พัดลมไม่หมุน',
                customerName: 'สมชาย ดีใจ',
                customerTel: '081-234-5678',
                imageUrl: ''
            },
            {
                claimId: 'CLM-2026-002',
                receiveStatus: 'รับสินค้าแล้ว',
                jobSupplier: 'SUP-JOB-992',
                claimResult: 'ซ่อมคืนตัวเดิม',
                repairReady: 'อยู่ระหว่าง Booking',
                remark: 'เปลี่ยนชิปเซ็ตบอร์ดเรียบร้อย',
                supplierCode: 'SUP001',
                senderAddress: 'Banana IT Mega Bangna, Samut Prakan',
                packingList: 'PK-99213',
                dhlBookingNo: 'DHL-887712',
                returnDestination: 'บ้านลูกค้า',
                returnDhlBookingNo: 'DHL-RT-11224',
                createTime: new Date('2026-06-01T10:30:00Z').getTime(),
                branchName: 'เมกาบางนา',
                productCategory: 'Smartphone',
                productName: 'iPhone 15 Pro Max 256GB',
                serialNumber: 'SN-APPL-334455',
                issueDescription: 'กล้องหลังสั่นและโฟกัสไม่ได้หลังอัพเกรด iOS',
                customerName: 'สมหญิง รักดี',
                customerTel: '089-876-5432',
                imageUrl: ''
            },
            {
                claimId: 'CLM-2026-003',
                receiveStatus: 'อยู่ระหว่างซ่อม',
                jobSupplier: 'SUP-JOB-501',
                claimResult: 'ยกเลิกซ่อม',
                repairReady: 'Booking แล้ว',
                remark: 'ลูกค้าขอเคลมคืนเครื่อง เนื่องจากเกินระยะเวลาข้อตกลง',
                supplierCode: 'SUP002',
                senderAddress: 'Banana IT Fashion Island, Bangkok',
                packingList: 'PK-55122',
                dhlBookingNo: 'DHL-442211',
                returnDestination: 'หน้าร้าน สาขาแฟชั่นไอส์แลนด์',
                returnDhlBookingNo: 'DHL-RT-88992',
                createTime: new Date('2026-05-30T14:15:00Z').getTime(),
                branchName: 'แฟชั่นไอส์แลนด์',
                productCategory: 'Tablet',
                productName: 'iPad Air 5 M1',
                serialNumber: 'SN-APPL-778899',
                issueDescription: 'ชาร์จไฟไม่เข้า แบตเตอรี่บวมจนหน้าจอดันตัวออกมา',
                customerName: 'วิชัย สมบูรณ์',
                customerTel: '086-555-1234',
                imageUrl: ''
            }
        ];

        for (const claim of defaultClaims) {
            await saveRecord('claims', claim);
        }
        console.log('Default claims seeded.');
    }
}

// Generic helper to count records
function getCount(storeName) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Generic helper to save or update record
function saveRecord(storeName, data) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Read all records from a store
function getAllRecords(storeName) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Read record by key
function getRecordByKey(storeName, key) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Delete record by key
function deleteRecordByKey(storeName, key) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

// Authenticate user check
async function authenticateUser(username, password) {
    const user = await getRecordByKey('users', username);
    if (!user) return null;
    const hashed = await hashPassword(password);
    if (user.password === hashed) {
        return {
            username: user.username,
            role: user.role,
            supplierCode: user.supplierCode
        };
    }
    return null;
}

// Exposed DB services
window.ClaimDB = {
    init: async () => {
        await openDB();
        await seedDatabase();
    },
    // User functions
    getUsers: () => getAllRecords('users'),
    addUser: async (username, password, role, supplierCode) => {
        const existing = await getRecordByKey('users', username);
        if (existing) {
            throw new Error('User already exists');
        }
        const hashedPassword = await hashPassword(password);
        return saveRecord('users', { username, password: hashedPassword, role, supplierCode });
    },
    deleteUser: (username) => deleteRecordByKey('users', username),
    authenticate: (username, password) => authenticateUser(username, password),

    // Claims functions
    getClaims: () => getAllRecords('claims'),
    getClaim: (claimId) => getRecordByKey('claims', claimId),
    saveClaim: (claim) => saveRecord('claims', claim),
    deleteClaim: (claimId) => deleteRecordByKey('claims', claimId)
};
