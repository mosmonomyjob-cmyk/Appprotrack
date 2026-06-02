/**
 * Claims Management System - Main App Controller.
 * Supports both Cloudflare API mode (D1 + JWT) and Local Fallback mode (IndexedDB + Web Crypto).
 */

// Global Application State
let state = {
    currentUser: null,
    claims: [],
    sortColumn: 'createTime',
    sortDirection: 'desc',
    imagePreviewData: '', // base64 representation of uploaded claim image
    importPendingClaims: [], // Temporary array to hold claims parsed from CSV/Excel
    apiMode: false // True if running on Cloudflare Pages with API Functions active
};

// Excel Header translation mapping
const HEADER_MAP = {
    'เลขที่ใบเคลม': 'claimId',
    'Claim ID': 'claimId',
    'Status-รับสินค้า': 'receiveStatus',
    'Receive Status': 'receiveStatus',
    'Job Supplier': 'jobSupplier',
    'ผลการเคลม': 'claimResult',
    'Claim Result': 'claimResult',
    'ซ่อมเสร็จพร้อมส่ง': 'repairReady',
    'Repair Ready': 'repairReady',
    'หมายเหตุ': 'remark',
    'Remark': 'remark',
    'Supplier Code': 'supplierCode',
    'ที่อยู่ผู้ส่ง- Banana': 'senderAddress',
    'Sender Address': 'senderAddress',
    'Packing List': 'packingList',
    'Booking Number DHL': 'dhlBookingNo',
    'ส่งกลับหน้าร้าน-บ้าน ลค.': 'returnDestination',
    'Return Destination': 'returnDestination',
    'Return - Booking Number DHL': 'returnDhlBookingNo',
    'Create Time': 'createTime',
    'ชื่อสาขา': 'branchName',
    'Branch Name': 'branchName',
    'Product': 'productCategory',
    'Product Name': 'productName',
    'Serial': 'serialNumber',
    'Serial Number': 'serialNumber',
    'อาการเสียที่ลูกค้าแจ้ง': 'issueDescription',
    'Issue': 'issueDescription',
    'ชื่อลูกค้า': 'customerName',
    'Customer Name': 'customerName',
    'Tel': 'customerTel',
    'รูปภาพ': 'imageUrl'
};

// Inverse header map for Excel Export
const EXPORT_HEADERS = {
    claimId: 'เลขที่ใบเคลม',
    receiveStatus: 'Status-รับสินค้า',
    jobSupplier: 'Job Supplier',
    claimResult: 'ผลการเคลม',
    repairReady: 'ซ่อมเสร็จพร้อมส่ง',
    remark: 'หมายเหตุ',
    supplierCode: 'Supplier Code',
    senderAddress: 'ที่อยู่ผู้ส่ง- Banana',
    packingList: 'Packing List',
    dhlBookingNo: 'Booking Number DHL',
    returnDestination: 'ส่งกลับหน้าร้าน-บ้าน ลค.',
    returnDhlBookingNo: 'Return - Booking Number DHL',
    createTime: 'Create Time',
    branchName: 'ชื่อสาขา',
    productCategory: 'Product',
    productName: 'Product Name',
    serialNumber: 'Serial',
    issueDescription: 'อาการเสียที่ลูกค้าแจ้ง',
    customerName: 'ชื่อลูกค้า',
    customerTel: 'Tel',
    imageUrl: 'รูปภาพ'
};

// Initialize Application on Page Load
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Detect if Cloudflare API backend is available
    state.apiMode = await detectApiMode();
    console.log(`Application Mode: ${state.apiMode ? 'Cloudflare API' : 'Local Fallback (IndexedDB)'}`);

    // 2. Initialize database (Local IndexedDB fallback only)
    if (!state.apiMode) {
        try {
            await window.ClaimDB.init();
        } catch (e) {
            console.error('Failed to init local database', e);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลจำลองในเบราว์เซอร์ กรุณารีเฟรชหน้าจอ');
        }
    }

    // 3. Set up Theme (Dark mode by default, check settings)
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleUI(savedTheme);

    // 4. Set up UI Event Listeners
    setupEventListeners();

    // 5. Check active user session
    const cachedUser = sessionStorage.getItem('claim_user');
    const cachedToken = sessionStorage.getItem('claim_token');
    
    if (cachedUser && (state.apiMode ? cachedToken : true)) {
        state.currentUser = JSON.parse(cachedUser);
        showDashboard();
    } else {
        showLoginScreen();
    }
});

// Detect server API availability
async function detectApiMode() {
    if (window.location.protocol === 'file:') {
        return false;
    }
    try {
        const response = await fetch('/api/claims', { method: 'OPTIONS' });
        // If the server responds with anything other than 404, APIs exist!
        return response.status !== 404;
    } catch (e) {
        return false;
    }
}

// Wrapper for Server Fetch adding JWT authorization header
async function apiFetch(url, options = {}) {
    const token = sessionStorage.getItem('claim_token');
    options.headers = options.headers || {};
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (options.body && !(options.body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, options);
    
    if (response.status === 401) {
        sessionStorage.removeItem('claim_user');
        sessionStorage.removeItem('claim_token');
        state.currentUser = null;
        alert('เซสชันของคุณหมดอายุ หรือเข้าสู่ระบบซ้อน กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
        showLoginScreen();
        throw new Error('Unauthorized');
    }
    
    return response;
}

// Update Theme Toggle UI
function updateThemeToggleUI(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Set up UI Event Listeners
function setupEventListeners() {
    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeToggleUI(newTheme);
    });

    // Login Form Submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (state.apiMode) {
            // API Mode - Cloudflare Pages Function
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                
                if (res.ok && data.success) {
                    state.currentUser = data.user;
                    sessionStorage.setItem('claim_user', JSON.stringify(data.user));
                    sessionStorage.setItem('claim_token', data.token);
                    showDashboard();
                } else {
                    alert(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
                }
            } catch (err) {
                alert('เกิดข้อผิดพลาดในการเชื่อมต่อ Server API: ' + err.message);
            }
        } else {
            // Offline/IndexedDB Mode
            const authenticatedUser = await window.ClaimDB.authenticate(username, password);
            if (authenticatedUser) {
                state.currentUser = authenticatedUser;
                sessionStorage.setItem('claim_user', JSON.stringify(authenticatedUser));
                showDashboard();
            } else {
                alert('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
            }
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
            sessionStorage.removeItem('claim_user');
            sessionStorage.removeItem('claim_token');
            state.currentUser = null;
            showLoginScreen();
        }
    });

    // Add Claim Click (Admin only)
    document.getElementById('btn-add-claim').addEventListener('click', () => {
        openClaimModal(null);
    });

    // Manage Users Click (Admin only)
    document.getElementById('btn-manage-users').addEventListener('click', () => {
        openUsersModal();
    });

    // Import Excel Modal Open (Admin only)
    document.getElementById('btn-import-excel').addEventListener('click', () => {
        document.getElementById('import-file-input').value = '';
        document.getElementById('import-preview-container').style.display = 'none';
        document.getElementById('btn-import-confirm').disabled = true;
        state.importPendingClaims = [];
        openModal('import-modal');
    });

    // File Input change for Excel import
    document.getElementById('import-file-input').addEventListener('change', handleExcelImportFile);

    // Confirm Bulk Import
    document.getElementById('btn-import-confirm').addEventListener('click', executeBulkImport);

    // Export Claims Click
    document.getElementById('btn-export-excel').addEventListener('click', exportClaimsToExcel);

    // Dynamic Search & Filters
    document.getElementById('search-filter').addEventListener('input', renderClaimsTable);
    document.getElementById('filter-receive-status').addEventListener('change', renderClaimsTable);
    document.getElementById('filter-claim-result').addEventListener('change', renderClaimsTable);
    document.getElementById('filter-repair-ready').addEventListener('change', renderClaimsTable);
    document.getElementById('filter-supplier-code').addEventListener('change', renderClaimsTable);

    // Edit/Add Claim Form Submission
    document.getElementById('claim-form').addEventListener('submit', handleClaimFormSubmit);

    // Image Upload input
    document.getElementById('form-image-file').addEventListener('change', handleImageUpload);

    // Manage Users Forms
    document.getElementById('create-user-form').addEventListener('submit', handleCreateUser);
    document.getElementById('new-role').addEventListener('change', (e) => {
        const group = document.getElementById('supplier-code-group');
        const codeInput = document.getElementById('new-supplier-code');
        if (e.target.value === 'admin') {
            group.style.display = 'none';
            codeInput.required = false;
            codeInput.value = '';
        } else {
            group.style.display = 'flex';
            codeInput.required = true;
        }
    });

    // Sorting Headers Click
    const tableHeaders = document.querySelectorAll('.data-table th.sortable');
    tableHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-column');
            if (state.sortColumn === col) {
                state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortColumn = col;
                state.sortDirection = 'desc'; // Default desc for new cols
            }

            // Update Header sort icons
            tableHeaders.forEach(header => {
                header.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(state.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');

            renderClaimsTable();
        });
    });
}

// Show Login Screen
function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('dashboard-screen').style.display = 'none';
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
}

// Show Claims Dashboard
async function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';

    // Set User Profile Display Info
    document.getElementById('current-user-display').textContent = state.currentUser.username;
    const roleBadge = document.getElementById('current-role-badge');
    roleBadge.textContent = state.currentUser.role === 'admin' ? 'Administrator' : `Supplier [${state.currentUser.supplierCode}]`;
    roleBadge.className = `role-badge ${state.currentUser.role}`;

    // Adjust UI based on user role
    adjustUIForRole();

    // Load filter options & claims data
    await populateFilters();
    await refreshClaimsData();
}

// Show/Hide buttons and control access based on Role
function adjustUIForRole() {
    const isAdmin = state.currentUser.role === 'admin';
    const adminElements = document.querySelectorAll('.admin-only');

    adminElements.forEach(el => {
        el.style.display = isAdmin ? 'inline-flex' : 'none';
    });

    // Hide supplier filter container for normal users, display for admin
    const supplierFilterContainer = document.getElementById('filter-supplier-container');
    if (supplierFilterContainer) {
        supplierFilterContainer.style.display = isAdmin ? 'block' : 'none';
    }
}

// Populate Admin Supplier Filter options based on database contents
async function populateFilters() {
    const filterSelect = document.getElementById('filter-supplier-code');
    if (!filterSelect) return;

    // Reset except first option
    filterSelect.innerHTML = '<option value="">-- Supplier Code ทั้งหมด --</option>';

    // Fetch distinct supplier codes
    const claims = state.claims.length > 0 ? state.claims : 
                   (state.apiMode ? [] : await window.ClaimDB.getClaims());
                   
    const codes = [...new Set(claims.map(c => c.supplierCode).filter(Boolean))].sort();

    codes.forEach(code => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = code;
        filterSelect.appendChild(option);
    });
}

// Fetch latest claims from database and re-render
async function refreshClaimsData() {
    try {
        if (state.apiMode) {
            const res = await apiFetch('/api/claims');
            state.claims = await res.json();
        } else {
            state.claims = await window.ClaimDB.getClaims();
        }
        renderClaimsTable();
        
        // Dynamically repopulate supplier filters as data grows
        if (state.currentUser.role === 'admin') {
            await populateFilters();
        }
    } catch (e) {
        console.error('Error refreshing claims data', e);
    }
}

// Render claims table and statistics based on search, filter, and sort states
function renderClaimsTable() {
    const tableBody = document.getElementById('claims-table-body');
    const emptyState = document.getElementById('table-empty');
    if (!tableBody) return;

    // 1. Fetch search & filters value
    const searchVal = document.getElementById('search-filter').value.toLowerCase().trim();
    const receiveStatusVal = document.getElementById('filter-receive-status').value;
    const claimResultVal = document.getElementById('filter-claim-result').value;
    const repairReadyVal = document.getElementById('filter-repair-ready').value;
    const supplierVal = document.getElementById('filter-supplier-code').value;

    // 2. Filter Claims based on role and criteria
    let filteredClaims = [...state.claims];

    // Role filtering: Non-admins only see their own supplier code (already filtered by API on server side, but good to double-check in UI)
    if (state.currentUser.role !== 'admin') {
        filteredClaims = filteredClaims.filter(c => c.supplierCode === state.currentUser.supplierCode);
    } else if (supplierVal) {
        // Admin supplier filter
        filteredClaims = filteredClaims.filter(c => c.supplierCode === supplierVal);
    }

    // Status filter
    if (receiveStatusVal) {
        filteredClaims = filteredClaims.filter(c => c.receiveStatus === receiveStatusVal);
    }
    // Claim result filter
    if (claimResultVal) {
        filteredClaims = filteredClaims.filter(c => c.claimResult === claimResultVal);
    }
    // Repair status filter
    if (repairReadyVal) {
        filteredClaims = filteredClaims.filter(c => c.repairReady === repairReadyVal);
    }

    // Search query filter (matches Claim ID, Serial, Customer Name, Branch, Product)
    if (searchVal) {
        filteredClaims = filteredClaims.filter(c => {
            return (
                (c.claimId && c.claimId.toLowerCase().includes(searchVal)) ||
                (c.serialNumber && c.serialNumber.toLowerCase().includes(searchVal)) ||
                (c.customerName && c.customerName.toLowerCase().includes(searchVal)) ||
                (c.branchName && c.branchName.toLowerCase().includes(searchVal)) ||
                (c.productName && c.productName.toLowerCase().includes(searchVal)) ||
                (c.productCategory && c.productCategory.toLowerCase().includes(searchVal))
            );
        });
    }

    // 3. Update Stat Cards based on current subset
    updateStats(filteredClaims);

    // 4. Sort Claims
    filteredClaims.sort((a, b) => {
        let valA = a[state.sortColumn] || '';
        let valB = b[state.sortColumn] || '';

        // Handle numeric/timestamp comparison
        if (state.sortColumn === 'createTime') {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // 5. Render Table Rows
    tableBody.innerHTML = '';
    
    if (filteredClaims.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';

    filteredClaims.forEach(claim => {
        const row = document.createElement('tr');
        
        // Status Badge classes
        const recBadgeClass = claim.receiveStatus === 'ยังไม่ได้รับ' ? 'badge-status-waiting' :
                              claim.receiveStatus === 'รับสินค้าแล้ว' ? 'badge-status-received' : 'badge-status-repairing';

        const resultBadgeClass = claim.claimResult === 'เปลี่ยนตัวใหม่' ? 'badge-claim-new' :
                                 claim.claimResult === 'ซ่อมคืนตัวเดิม' ? 'badge-claim-repair' : 'badge-claim-cancel';

        const readyBadgeClass = claim.repairReady === 'เสร็จแล้วรอ Book' ? 'badge-ready-wait' :
                                claim.repairReady === 'อยู่ระหว่าง Booking' ? 'badge-ready-booking' : 'badge-ready-booked';

        // Format dates
        const dateStr = claim.createTime ? new Date(claim.createTime).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '-';

        row.innerHTML = `
            <td><div style="font-size:0.8rem; color:var(--text-muted);">${dateStr}</div></td>
            <td class="claim-id-cell">${claim.claimId || '-'}</td>
            <td class="product-cell">
                <div class="prod-name" title="${claim.productName || '-'}">${claim.productName || '-'}</div>
                <div class="prod-meta">S/N: ${claim.serialNumber || '-'} | สาขา: ${claim.branchName || '-'}</div>
            </td>
            <td><span style="font-weight:600;">${claim.supplierCode || '-'}</span></td>
            <td><span class="badge ${recBadgeClass}">${claim.receiveStatus || '-'}</span></td>
            <td><span style="font-family:monospace; font-weight:500;">${claim.jobSupplier || '-'}</span></td>
            <td><span class="badge ${resultBadgeClass}">${claim.claimResult || '-'}</span></td>
            <td><span class="badge ${readyBadgeClass}">${claim.repairReady || '-'}</span></td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${claim.remark || ''}">
                ${claim.remark || '-'}
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center;">
                    <button class="btn btn-secondary btn-sm" onclick="openClaimModal('${claim.claimId}')" title="รายละเอียด / แก้ไข">
                        ${state.currentUser.role === 'admin' ? '⚙️ แก้ไข' : '👁️ อัพเดต'}
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="openPrintPreview('${claim.claimId}')" title="พิมพ์เอกสารงานเคลม">
                        🖨️ พิมพ์
                    </button>
                    ${state.currentUser.role === 'admin' ? `
                    <button class="btn btn-danger btn-sm btn-icon" onclick="deleteClaimRecord('${claim.claimId}')" title="ลบงานเคลม">
                        🗑️
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Calculate and render stats counters
function updateStats(claimsList) {
    const total = claimsList.length;
    const pending = claimsList.filter(c => c.receiveStatus === 'ยังไม่ได้รับ').length;
    const repairing = claimsList.filter(c => c.receiveStatus === 'อยู่ระหว่างซ่อม').length;
    const completed = claimsList.filter(c => c.repairReady === 'Booking แล้ว').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-repairing').textContent = repairing;
    document.getElementById('stat-completed').textContent = completed;
}

// Delete claim record
async function deleteClaimRecord(claimId) {
    if (confirm(`คุณต้องการลบข้อมูลใบเคลมเลขที่ ${claimId} ใช่หรือไม่? ข้อมูลนี้จะหายไปถาวร`)) {
        try {
            if (state.apiMode) {
                const res = await apiFetch(`/api/claims?claimId=${claimId}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'ไม่สามารถลบข้อมูลบน Server D1 ได้');
            } else {
                await window.ClaimDB.deleteClaim(claimId);
            }
            await refreshClaimsData();
        } catch (e) {
            alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + e.message);
        }
    }
}

// Open Claim Editor Modal
async function openClaimModal(claimId = null) {
    const modalTitle = document.getElementById('claim-modal-title');
    const form = document.getElementById('claim-form');
    const formMode = document.getElementById('form-mode');
    
    // Reset image preview state
    state.imagePreviewData = '';
    document.getElementById('form-image-file').value = '';
    document.getElementById('form-image-preview').style.display = 'none';
    document.getElementById('image-preview-placeholder').style.display = 'flex';

    const isAdmin = state.currentUser.role === 'admin';

    // Control enable/disable of admin fields
    const adminFields = document.querySelectorAll('.admin-field');
    adminFields.forEach(field => {
        field.disabled = !isAdmin;
    });

    if (claimId) {
        // Edit Mode
        modalTitle.textContent = isAdmin ? 'แก้ไขรายละเอียดใบเคลม' : 'อัพเดตสถานะงานเคลม';
        formMode.value = 'edit';
        
        // Fetch claim details
        const claim = state.claims.find(c => c.claimId === claimId) || 
                      (state.apiMode ? null : await window.ClaimDB.getClaim(claimId));
                      
        if (!claim) {
            if (state.apiMode) {
                // If not found in memory (fallback API read if needed)
                try {
                    const res = await apiFetch(`/api/claims`);
                    const allClaims = await res.json();
                    const liveClaim = allClaims.find(c => c.claimId === claimId);
                    if (liveClaim) populateForm(liveClaim);
                } catch(e) { alert('ไม่พบข้อมูลเคลม'); return; }
            }
            return;
        }

        populateForm(claim);
    } else {
        // Add Mode (Admin only)
        modalTitle.textContent = 'เพิ่มรายการใบเคลมใหม่';
        formMode.value = 'add';
        form.reset();
        document.getElementById('form-claim-id').readOnly = false;
        document.getElementById('form-create-time').value = Date.now();
    }

    openModal('claim-modal');
}

// Helper to write claim info directly into form elements
function populateForm(claim) {
    document.getElementById('form-claim-id').value = claim.claimId || '';
    document.getElementById('form-claim-id').readOnly = true; // Cannot edit primary key ID in edit mode
    
    document.getElementById('form-supplier-code').value = claim.supplierCode || '';
    document.getElementById('form-branch-name').value = claim.branchName || '';
    document.getElementById('form-product-category').value = claim.productCategory || '';
    document.getElementById('form-product-name').value = claim.productName || '';
    document.getElementById('form-serial-number').value = claim.serialNumber || '';
    document.getElementById('form-customer-name').value = claim.customerName || '';
    document.getElementById('form-customer-tel').value = claim.customerTel || '';
    document.getElementById('form-issue-description').value = claim.issueDescription || '';
    
    document.getElementById('form-sender-address').value = claim.senderAddress || '';
    document.getElementById('form-packing-list').value = claim.packingList || '';
    document.getElementById('form-dhl-booking-no').value = claim.dhlBookingNo || '';
    document.getElementById('form-return-destination').value = claim.returnDestination || '';
    document.getElementById('form-return-dhl-booking-no').value = claim.returnDhlBookingNo || '';
    
    document.getElementById('form-receive-status').value = claim.receiveStatus || 'ยังไม่ได้รับ';
    document.getElementById('form-job-supplier').value = claim.jobSupplier || '';
    document.getElementById('form-claim-result').value = claim.claimResult || 'เปลี่ยนตัวใหม่';
    document.getElementById('form-repair-ready').value = claim.repairReady || 'เสร็จแล้วรอ Book';
    document.getElementById('form-remark').value = claim.remark || '';
    
    document.getElementById('form-create-time').value = claim.createTime || Date.now();

    // Load image if exists
    if (claim.imageUrl) {
        state.imagePreviewData = claim.imageUrl;
        document.getElementById('form-image-preview').src = claim.imageUrl;
        document.getElementById('form-image-preview').style.display = 'block';
        document.getElementById('image-preview-placeholder').style.display = 'none';
    }
}

// Handle image upload and convert to base64
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
        alert('ขนาดไฟล์รูปภาพใหญ่เกินไป (ไม่ควรเกิน 4MB)');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        state.imagePreviewData = event.target.result;
        document.getElementById('form-image-preview').src = event.target.result;
        document.getElementById('form-image-preview').style.display = 'block';
        document.getElementById('image-preview-placeholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Submit Claim form (enforces Cloudflare D1 mapping or IndexedDB local calls)
async function handleClaimFormSubmit(e) {
    e.preventDefault();

    const claimId = document.getElementById('form-claim-id').value.trim();
    const mode = document.getElementById('form-mode').value;

    if (mode === 'add' && !state.apiMode) {
        // Local mode unique verification
        const existing = await window.ClaimDB.getClaim(claimId);
        if (existing) {
            alert('เลขที่ใบเคลมนี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่นหรือทำการแก้ไขใบเคลมเดิม');
            return;
        }
    }

    const claimData = {
        claimId,
        receiveStatus: document.getElementById('form-receive-status').value,
        jobSupplier: document.getElementById('form-job-supplier').value.trim(),
        claimResult: document.getElementById('form-claim-result').value,
        repairReady: document.getElementById('form-repair-ready').value,
        remark: document.getElementById('form-remark').value.trim(),
        
        // Core fields
        supplierCode: document.getElementById('form-supplier-code').value.trim(),
        senderAddress: document.getElementById('form-sender-address').value.trim(),
        packingList: document.getElementById('form-packing-list').value.trim(),
        dhlBookingNo: document.getElementById('form-dhl-booking-no').value.trim(),
        returnDestination: document.getElementById('form-return-destination').value.trim(),
        returnDhlBookingNo: document.getElementById('form-return-dhl-booking-no').value.trim(),
        
        branchName: document.getElementById('form-branch-name').value.trim(),
        productCategory: document.getElementById('form-product-category').value.trim(),
        productName: document.getElementById('form-product-name').value.trim(),
        serialNumber: document.getElementById('form-serial-number').value.trim(),
        issueDescription: document.getElementById('form-issue-description').value.trim(),
        customerName: document.getElementById('form-customer-name').value.trim(),
        customerTel: document.getElementById('form-customer-tel').value.trim(),
        
        createTime: Number(document.getElementById('form-create-time').value) || Date.now(),
        imageUrl: state.imagePreviewData
    };

    try {
        if (state.apiMode) {
            // Write to Cloudflare Pages API -> D1 DB
            const res = await apiFetch('/api/claims', {
                method: 'POST',
                body: JSON.stringify(claimData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'บันทึกเคลมไม่สำเร็จบน Cloudflare Server');
        } else {
            // Write to Offline IndexedDB
            await window.ClaimDB.saveClaim(claimData);
        }
        
        closeModal('claim-modal');
        await refreshClaimsData();
    } catch (err) {
        alert('ไม่สามารถบันทึกข้อมูลได้: ' + err.message);
    }
}

// Open Print Preview Modal
async function openPrintPreview(claimId) {
    const claim = state.claims.find(c => c.claimId === claimId) || 
                  (state.apiMode ? null : await window.ClaimDB.getClaim(claimId));
    if (!claim) return;

    const printContainer = document.getElementById('print-document-container');
    const dateStr = claim.createTime ? new Date(claim.createTime).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '-';

    printContainer.innerHTML = `
        <div class="print-header">
            <div class="print-logo-info">
                <h2>AppProTrack</h2>
                <p>ระบบรายงานบันทึกประวัติการส่งเคลมสินค้าและบริการ</p>
                <p>ที่อยู่จัดส่งคืน: ${claim.senderAddress || '-'}</p>
            </div>
            <div class="print-doc-meta">
                <h1>เอกสารงานเคลมสินค้า</h1>
                <p><strong>เลขที่ใบเคลม:</strong> ${claim.claimId}</p>
                <p><strong>วันที่รับเคลม:</strong> ${dateStr}</p>
                <p><strong>ผู้จัดจำหน่าย (Supplier):</strong> ${claim.supplierCode || '-'}</p>
            </div>
        </div>

        <div class="print-grid">
            <div class="print-section">
                <h4>1. รายละเอียดข้อมูลสินค้า</h4>
                <div class="print-row"><span class="print-label">หมวดหมู่:</span><span class="print-value">${claim.productCategory || '-'}</span></div>
                <div class="print-row"><span class="print-label">ชื่อสินค้า:</span><span class="print-value">${claim.productName || '-'}</span></div>
                <div class="print-row"><span class="print-label">Serial Number:</span><span class="print-value" style="font-family: monospace; font-weight:600;">${claim.serialNumber || '-'}</span></div>
                <div class="print-row"><span class="print-label">อาการเสียแจ้ง:</span><span class="print-value" style="color:var(--danger);">${claim.issueDescription || '-'}</span></div>
            </div>

            <div class="print-section">
                <h4>2. ข้อมูลลูกค้าและสาขา</h4>
                <div class="print-row"><span class="print-label">ชื่อลูกค้า:</span><span class="print-value">${claim.customerName || '-'}</span></div>
                <div class="print-row"><span class="print-label">เบอร์โทรศัพท์:</span><span class="print-value">${claim.customerTel || '-'}</span></div>
                <div class="print-row"><span class="print-label">ชื่อสาขาผู้รับ:</span><span class="print-value">${claim.branchName || '-'}</span></div>
                <div class="print-row"><span class="print-label">ที่อยู่ผู้ส่งเคลม:</span><span class="print-value">${claim.senderAddress || '-'}</span></div>
            </div>
        </div>

        <div class="print-grid">
            <div class="print-section">
                <h4>3. ข้อมูลการดำเนินงานของ Supplier</h4>
                <div class="print-row"><span class="print-label">สถานะการรับสินค้า:</span><span class="print-value"><strong>${claim.receiveStatus || '-'}</strong></span></div>
                <div class="print-row"><span class="print-label">Job Supplier:</span><span class="print-value" style="font-family: monospace;">${claim.jobSupplier || '-'}</span></div>
                <div class="print-row"><span class="print-label">ผลการเคลม:</span><span class="print-value"><strong>${claim.claimResult || '-'}</strong></span></div>
                <div class="print-row"><span class="print-label">ความคืบหน้าการซ่อม:</span><span class="print-value"><strong>${claim.repairReady || '-'}</strong></span></div>
                <div class="print-row"><span class="print-label">หมายเหตุ:</span><span class="print-value">${claim.remark || '-'}</span></div>
            </div>

            <div class="print-section">
                <h4>4. ข้อมูลการขนส่งสินค้าเคลมคืน</h4>
                <div class="print-row"><span class="print-label">Packing List No:</span><span class="print-value">${claim.packingList || '-'}</span></div>
                <div class="print-row"><span class="print-label">เลข DHL ขาส่งมา:</span><span class="print-value">${claim.dhlBookingNo || '-'}</span></div>
                <div class="print-row"><span class="print-label">ส่งกลับหน้าร้าน/บ้าน:</span><span class="print-value">${claim.returnDestination || '-'}</span></div>
                <div class="print-row"><span class="print-label">เลข DHL ขากลับ:</span><span class="print-value" style="font-family: monospace; font-weight:600;">${claim.returnDhlBookingNo || '-'}</span></div>
            </div>
        </div>

        ${claim.imageUrl ? `
        <div class="print-img-section">
            <h4>5. รูปภาพแนบหลักฐานการเคลม</h4>
            <div class="print-images-container">
                <div class="print-image-card">
                    <img src="${claim.imageUrl}" alt="หลักฐานชำรุดเสียหาย">
                </div>
            </div>
        </div>
        ` : ''}

        <div class="print-footer">
            <div class="print-sign">
                <div class="print-sign-line"></div>
                <div class="print-sign-title">ผู้ส่งคืนสินค้า / สาขาเจ้าหน้าที่</div>
            </div>
            <div class="print-sign">
                <div class="print-sign-line"></div>
                <div class="print-sign-title">ผู้ให้บริการตรวจสอบ (Supplier)</div>
            </div>
        </div>
    `;

    openModal('print-modal');
}

// User Management Modal Actions
async function openUsersModal() {
    await refreshUsersList();
    
    // Reset form
    document.getElementById('create-user-form').reset();
    document.getElementById('supplier-code-group').style.display = 'flex';
    document.getElementById('new-supplier-code').required = true;
    
    openModal('users-modal');
}

// Refresh Users list
async function refreshUsersList() {
    const listContainer = document.getElementById('users-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    
    let users = [];
    try {
        if (state.apiMode) {
            const res = await apiFetch('/api/users');
            users = await res.json();
        } else {
            users = await window.ClaimDB.getUsers();
        }
    } catch (e) {
        console.error('Error fetching users', e);
        listContainer.innerHTML = '<div style="padding:16px; text-align:center; color:var(--danger);">ไม่สามารถดึงข้อมูลผู้ใช้งานได้</div>';
        return;
    }

    if (users.length === 0) {
        listContainer.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">ไม่มีบัญชีผู้ใช้อื่นในระบบ</div>';
        return;
    }

    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'user-item';
        
        const badgeClass = user.role === 'admin' ? 'admin' : 'user';
        const codeDisplay = user.supplierCode ? ` | [${user.supplierCode}]` : '';

        item.innerHTML = `
            <div class="user-item-info">
                <span class="username-lbl">${user.username}</span>
                <span class="role-lbl"><span class="role-badge ${badgeClass}">${user.role}</span>${codeDisplay}</span>
            </div>
            <div>
                ${user.username !== 'admin' && user.username !== state.currentUser.username ? `
                    <button class="btn btn-danger btn-sm" onclick="deleteUserAccount('${user.username}')">ลบ</button>
                ` : '<span style="font-size:0.75rem; color:var(--text-muted);">ระบบล็อกไว้</span>'}
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// Delete user account
async function deleteUserAccount(username) {
    if (confirm(`คุณแน่ใจว่าต้องการลบชื่อผู้ใช้ ${username} หรือไม่?`)) {
        try {
            if (state.apiMode) {
                const res = await apiFetch(`/api/users?username=${username}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'ลบผู้ใช้บน Server D1 ล้มเหลว');
            } else {
                await window.ClaimDB.deleteUser(username);
            }
            await refreshUsersList();
        } catch (e) {
            alert('ไม่สามารถลบผู้ใช้งานได้: ' + e.message);
        }
    }
}

// Handle User Creation form submit
async function handleCreateUser(e) {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim().toLowerCase();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    const supplierCode = document.getElementById('new-supplier-code').value.trim();

    if (password.length < 4) {
        alert('รหัสผ่านควรมีความยาวอย่างน้อย 4 ตัวอักษร');
        return;
    }

    if (role === 'user' && !supplierCode) {
        alert('บัญชีบทบาท User (Supplier) จำเป็นต้องมีรหัส Supplier Code');
        return;
    }

    try {
        if (state.apiMode) {
            const res = await apiFetch('/api/users', {
                method: 'POST',
                body: JSON.stringify({ username, password, role, supplierCode })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'ล้มเหลวในการสร้างผู้ใช้บน Server');
        } else {
            await window.ClaimDB.addUser(username, password, role, supplierCode);
        }
        
        document.getElementById('create-user-form').reset();
        await refreshUsersList();
        alert('สร้างบัญชีผู้ใช้ใหม่เรียบร้อยแล้ว');
    } catch (err) {
        alert('ผิดพลาด: ' + err.message);
    }
}

// ==========================================
// EXCEL / CSV BULK IMPORT & PARSING
// ==========================================

// Parse Excel/CSV File on Input select
function handleExcelImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Raw list of objects
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            
            if (jsonData.length === 0) {
                alert('ไม่พบข้อมูลงานเคลมในแผ่นงานนี้');
                return;
            }

            // Map spreadsheet columns to database schema
            const mappedClaims = jsonData.map((row, idx) => {
                const claim = {};
                
                // Set default status values if empty
                claim.receiveStatus = 'ยังไม่ได้รับ';
                claim.claimResult = 'เปลี่ยนตัวใหม่';
                claim.repairReady = 'เสร็จแล้วรอ Book';
                claim.createTime = Date.now() + idx; // Ensure slightly different timestamp sorting
                claim.imageUrl = '';

                // Map file headers using TRANSLATION MAP
                for (const key in row) {
                    const cleanKey = key.trim();
                    const databaseField = HEADER_MAP[cleanKey];
                    if (databaseField) {
                        let value = row[key];
                        // Special parsing for numeric values, string trims, etc.
                        if (databaseField === 'createTime' && value) {
                            // If Excel Date format
                            if (!isNaN(value) && Number(value) > 30000) {
                                value = new Date((value - 25569) * 86400 * 1000).getTime();
                            } else {
                                value = new Date(value).getTime() || Date.now();
                            }
                        }
                        claim[databaseField] = String(value).trim();
                    }
                }

                // If claim ID is empty, assign standard serial increment claimId
                if (!claim.claimId) {
                    claim.claimId = 'CLM-IMP-' + (Date.now().toString().slice(-6)) + idx;
                }

                return claim;
            });

            // Store in state to wait for confirm
            state.importPendingClaims = mappedClaims;

            // Render import preview
            const previewContainer = document.getElementById('import-preview-container');
            const previewList = document.getElementById('import-preview-list');
            const countLabel = document.getElementById('import-count-label');

            previewList.innerHTML = '';
            countLabel.textContent = mappedClaims.length;

            mappedClaims.slice(0, 10).forEach(claim => {
                const item = document.createElement('div');
                item.className = 'import-preview-item';
                item.innerHTML = `
                    <span><strong>${claim.claimId}</strong> - ${claim.productName || 'ไม่ระบุชื่อสินค้า'}</span>
                    <span style="color: var(--text-muted);">S/N: ${claim.serialNumber || '-'} | Sup: ${claim.supplierCode || '-'}</span>
                `;
                previewList.appendChild(item);
            });

            if (mappedClaims.length > 10) {
                const moreItem = document.createElement('div');
                moreItem.style.padding = '8px 0';
                moreItem.style.textAlign = 'center';
                moreItem.style.color = 'var(--text-muted)';
                moreItem.textContent = `... และรายการอื่นอีก ${mappedClaims.length - 10} รายการ`;
                previewList.appendChild(moreItem);
            }

            previewContainer.style.display = 'block';
            document.getElementById('btn-import-confirm').disabled = false;

        } catch (err) {
            console.error('Error parsing sheet', err);
            alert('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์ Excel/CSV อีกครั้ง: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Save bulk parsed records
async function executeBulkImport() {
    if (state.importPendingClaims.length === 0) return;

    try {
        let successCount = 0;
        for (const claim of state.importPendingClaims) {
            if (state.apiMode) {
                const res = await apiFetch('/api/claims', {
                    method: 'POST',
                    body: JSON.stringify(claim)
                });
                if (!res.ok) throw new Error(`ไม่สามารถอิมพอร์ตไอดี ${claim.claimId} ได้`);
            } else {
                await window.ClaimDB.saveClaim(claim);
            }
            successCount++;
        }

        closeModal('import-modal');
        await refreshClaimsData();
        alert(`นำเข้าข้อมูลเคลมสินค้าสำเร็จจำนวน ${successCount} รายการเรียบร้อยแล้ว!`);
    } catch (e) {
        alert('เกิดข้อผิดพลาดระหว่างนำเข้าข้อมูลบางรายการ: ' + e.message);
    }
}

// ==========================================
// EXCEL EXPORT SERVICE
// ==========================================

// Exports currently filtered claims list to spreadsheet download
async function exportClaimsToExcel() {
    // 1. Get filtered list matching UI rules
    const searchVal = document.getElementById('search-filter').value.toLowerCase().trim();
    const receiveStatusVal = document.getElementById('filter-receive-status').value;
    const claimResultVal = document.getElementById('filter-claim-result').value;
    const repairReadyVal = document.getElementById('filter-repair-ready').value;
    const supplierVal = document.getElementById('filter-supplier-code') ? document.getElementById('filter-supplier-code').value : '';

    let exportList = [...state.claims];

    // Filter by role scope
    if (state.currentUser.role !== 'admin') {
        exportList = exportList.filter(c => c.supplierCode === state.currentUser.supplierCode);
    } else if (supplierVal) {
        exportList = exportList.filter(c => c.supplierCode === supplierVal);
    }

    // Apply UI dropdown filters
    if (receiveStatusVal) exportList = exportList.filter(c => c.receiveStatus === receiveStatusVal);
    if (claimResultVal) exportList = exportList.filter(c => c.claimResult === claimResultVal);
    if (repairReadyVal) exportList = exportList.filter(c => c.repairReady === repairReadyVal);

    // Apply search filter
    if (searchVal) {
        exportList = exportList.filter(c => {
            return (
                (c.claimId && c.claimId.toLowerCase().includes(searchVal)) ||
                (c.serialNumber && c.serialNumber.toLowerCase().includes(searchVal)) ||
                (c.customerName && c.customerName.toLowerCase().includes(searchVal)) ||
                (c.branchName && c.branchName.toLowerCase().includes(searchVal)) ||
                (c.productName && c.productName.toLowerCase().includes(searchVal))
            );
        });
    }

    if (exportList.length === 0) {
        alert('ไม่มีข้อมูลงานเคลมตามเงื่อนไขตัวกรองที่จะส่งออก');
        return;
    }

    // 2. Prepare and translate rows to Thai headers
    const rowsToExport = exportList.map(claim => {
        const formattedRow = {};
        
        // Translate schema keys to Thai Column headers
        for (const key in EXPORT_HEADERS) {
            let val = claim[key] || '';
            if (key === 'createTime' && val) {
                val = new Date(val).toLocaleDateString('th-TH') + ' ' + new Date(val).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            }
            // Skip long base64 image strings from polluting Excel cells
            if (key === 'imageUrl' && val.startsWith('data:image')) {
                val = '[รูปภาพแนบอัปโหลดแล้ว]';
            }
            formattedRow[EXPORT_HEADERS[key]] = val;
        }
        return formattedRow;
    });

    try {
        // 3. Generate SheetJS workbook
        const worksheet = XLSX.utils.json_to_sheet(rowsToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'รายการส่งเคลมสินค้า');
        
        // Save file
        const filename = `claims_report_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(workbook, filename);
    } catch (e) {
        alert('เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel: ' + e.message);
    }
}

// ==========================================
// MODAL GENERAL CONTROLS
// ==========================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock main scroll
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Unlock scroll
    }
}

// Export functions globally to allow onclick handler inside HTML strings
window.closeModal = closeModal;
window.openClaimModal = openClaimModal;
window.openPrintPreview = openPrintPreview;
window.deleteClaimRecord = deleteClaimRecord;
window.deleteUserAccount = deleteUserAccount;
