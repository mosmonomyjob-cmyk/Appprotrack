-- ==========================================================================
-- CLOUDFLARE D1 SQL DATABASE SCHEMA & MIGRATION SEED
-- Database name: appprotrack-db
-- ==========================================================================

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,          -- Hashed using SHA-256
    role TEXT NOT NULL,              -- 'admin' or 'user'
    supplierCode TEXT                -- Mandatory for user accounts
);

-- 2. Create Claims Table
CREATE TABLE IF NOT EXISTS claims (
    claimId TEXT PRIMARY KEY,
    receiveStatus TEXT,
    jobSupplier TEXT,
    claimResult TEXT,
    repairReady TEXT,
    remark TEXT,
    supplierCode TEXT,
    senderAddress TEXT,
    packingList TEXT,
    dhlBookingNo TEXT,
    returnDestination TEXT,
    returnDhlBookingNo TEXT,
    createTime INTEGER,
    branchName TEXT,
    productCategory TEXT,
    productName TEXT,
    serialNumber TEXT,
    issueDescription TEXT,
    customerName TEXT,
    customerTel TEXT,
    imageUrl TEXT                    -- Housed as Base64 string
);

-- 3. Indexes for Optimized Searching
CREATE INDEX IF NOT EXISTS idx_claims_supplier ON claims(supplierCode);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(receiveStatus);

-- 4. Seed Default Testing Accounts (Password is "password" hashed in SHA-256)
-- 'password' SHA-256 hash: 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8

INSERT OR IGNORE INTO users (username, password, role, supplierCode) 
VALUES ('admin', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'admin', '');

INSERT OR IGNORE INTO users (username, password, role, supplierCode) 
VALUES ('banana_sup1', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'user', 'SUP001');

INSERT OR IGNORE INTO users (username, password, role, supplierCode) 
VALUES ('banana_sup2', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'user', 'SUP002');

-- 5. Seed Mock Claims Data
INSERT OR IGNORE INTO claims (
    claimId, receiveStatus, jobSupplier, claimResult, repairReady, remark, 
    supplierCode, senderAddress, packingList, dhlBookingNo, returnDestination, 
    returnDhlBookingNo, createTime, branchName, productCategory, productName, 
    serialNumber, issueDescription, customerName, customerTel, imageUrl
) VALUES (
    'CLM-2026-001', 'ยังไม่ได้รับ', 'SUP-JOB-991', 'เปลี่ยนตัวใหม่', 'เสร็จแล้วรอ Book', 
    'รอดำเนินการขนส่งทดแทน', 'SUP001', 'Banana IT Rama 9 Road, Bangkok', 'PK-99212', 
    'DHL-887711', 'หน้าร้าน สาขาเซ็นทรัลพระราม 9', 'DHL-RT-11223', 1779344400000, 
    'เซ็นทรัลพระราม 9', 'Laptop', 'Asus ROG Strix G16', 'SN-ASUS-9988221', 
    'หน้าจอเปิดไม่ติด ไฟคีย์บอร์ดกระพริบแต่พัดลมไม่หมุน', 'สมชาย ดีใจ', '081-234-5678', ''
);

INSERT OR IGNORE INTO claims (
    claimId, receiveStatus, jobSupplier, claimResult, repairReady, remark, 
    supplierCode, senderAddress, packingList, dhlBookingNo, returnDestination, 
    returnDhlBookingNo, createTime, branchName, productCategory, productName, 
    serialNumber, issueDescription, customerName, customerTel, imageUrl
) VALUES (
    'CLM-2026-002', 'รับสินค้าแล้ว', 'SUP-JOB-992', 'ซ่อมคืนตัวเดิม', 'อยู่ระหว่าง Booking', 
    'เปลี่ยนชิปเซ็ตบอร์ดเรียบร้อย', 'SUP001', 'Banana IT Mega Bangna, Samut Prakan', 'PK-99213', 
    'DHL-887712', 'บ้านลูกค้า', 'DHL-RT-11224', 1779349800000, 
    'เมกาบางนา', 'Smartphone', 'iPhone 15 Pro Max 256GB', 'SN-APPL-334455', 
    'กล้องหลังสั่นและโฟกัสไม่ได้หลังอัพเกรด iOS', 'สมหญิง รักดี', '089-876-5432', ''
);

INSERT OR IGNORE INTO claims (
    claimId, receiveStatus, jobSupplier, claimResult, repairReady, remark, 
    supplierCode, senderAddress, packingList, dhlBookingNo, returnDestination, 
    returnDhlBookingNo, createTime, branchName, productCategory, productName, 
    serialNumber, issueDescription, customerName, customerTel, imageUrl
) VALUES (
    'CLM-2026-003', 'อยู่ระหว่างซ่อม', 'SUP-JOB-501', 'ยกเลิกซ่อม', 'Booking แล้ว', 
    'ลูกค้าขอเคลมคืนเครื่อง เนื่องจากเกินระยะเวลาข้อตกลง', 'SUP002', 'Banana IT Fashion Island, Bangkok', 'PK-55122', 
    'DHL-442211', 'หน้าร้าน สาขาแฟชั่นไอส์แลนด์', 'DHL-RT-88992', 1779183300000, 
    'แฟชั่นไอส์แลนด์', 'Tablet', 'iPad Air 5 M1', 'SN-APPL-778899', 
    'ชาร์จไฟไม่เข้า แบตเตอรี่บวมจนหน้าจอดันตัวออกมา', 'วิชัย สมบูรณ์', '086-555-1234', ''
);
