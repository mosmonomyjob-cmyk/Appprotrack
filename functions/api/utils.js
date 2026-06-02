/**
 * Utility functions for Cloudflare Pages Functions.
 * Implements JWT authentication (HS256) using Web Crypto API and database helper response templates.
 */

const DEFAULT_JWT_SECRET = 'appprotrack-jwt-secret-key-2026';

// Helper to construct JSON Response
export function jsonResponse(data, status = 200, headers = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...defaultHeaders, ...headers }
    });
}

// Helper to hash password using Web Crypto API (SHA-256) - server side
export async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert Array Buffer to Base64 Url Safe string
async function base64urlEncode(arrayBuffer) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Decode Base64 Url Safe string to Uint8Array
function base64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

// Signs a JSON Web Token
export async function signJWT(payload, secret = DEFAULT_JWT_SECRET) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encoder = new TextEncoder();
    
    // Set default expiration (e.g. 24 hours)
    if (!payload.exp) {
        payload.exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    }
    
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const dataToSign = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, dataToSign);
    const encodedSignature = await base64urlEncode(signature);
    
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// Verifies a JSON Web Token
export async function verifyJWT(token, secret = DEFAULT_JWT_SECRET) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [headerPart, payloadPart, signaturePart] = parts;
        const encoder = new TextEncoder();
        
        const dataToVerify = encoder.encode(`${headerPart}.${payloadPart}`);
        const signature = base64urlDecode(signaturePart);
        
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        const isValid = await crypto.subtle.verify('HMAC', key, signature, dataToVerify);
        if (!isValid) return null;
        
        // Convert Base64 URL safe back to regular base64 before decoding
        const decodedPayload = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(decodedPayload);
        
        // Expiry check
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            return null;
        }
        
        return payload;
    } catch (e) {
        console.error('JWT Verification error:', e);
        return null;
    }
}

// Extract token from authorization header
export async function getUserFromRequest(request, secret = DEFAULT_JWT_SECRET) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    return await verifyJWT(token, secret);
}
