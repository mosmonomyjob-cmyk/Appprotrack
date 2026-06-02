# PowerShell Static Web Server for Claim Management System
# Serves the current directory on http://localhost:8080/

$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

$currentDir = Get-Location
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Starting claim tracking web server..." -ForegroundColor Cyan
Write-Host " Root Directory: $currentDir" -ForegroundColor White
Write-Host " Local Address:  http://localhost:$port/" -ForegroundColor Green
Write-Host " Press Ctrl+C in terminal to stop server." -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan

try {
    $listener.Start()
} catch {
    Write-Host "Error starting listener: $_" -ForegroundColor Red
    Write-Host "Check if port $port is already in use by another application." -ForegroundColor Red
    exit
}

while ($true) {
    try {
        $context = $listener.GetContext()
    } catch {
        break
    }
    $request = $context.Request
    $response = $context.Response

    $urlPath = $request.Url.LocalPath
    # Default to index.html for root path
    if ($urlPath -eq "/" -or $urlPath -eq "") {
        $urlPath = "/index.html"
    }

    # Clean URL path and build file path
    $cleanPath = $urlPath.Replace("/", "\").TrimStart("\")
    $filePath = Join-Path $currentDir $cleanPath

    # Log request
    $timeStr = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timeStr] $($request.HttpMethod) $($request.Url.PathAndQuery)" -ForegroundColor Gray

    if (Test-Path $filePath -PathType Leaf) {
        try {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Match mime types
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "text/plain"
            switch ($ext) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".htm"  { $contentType = "text/html; charset=utf-8" }
                ".css"  { $contentType = "text/css" }
                ".js"   { $contentType = "application/javascript" }
                ".json" { $contentType = "application/json" }
                ".png"  { $contentType = "image/png" }
                ".jpg"  { $contentType = "image/jpeg" }
                ".jpeg" { $contentType = "image/jpeg" }
                ".gif"  { $contentType = "image/gif" }
                ".svg"  { $contentType = "image/svg+xml" }
                ".ico"  { $contentType = "image/x-icon" }
            }

            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
            Write-Host "Error serving $($urlPath): $_" -ForegroundColor Red
            $response.StatusCode = 500
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("500 Internal Server Error: $_")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
    } else {
        # File not found
        Write-Host "404 Not Found: $($urlPath)" -ForegroundColor Red
        $response.StatusCode = 404
        $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found")
        $response.ContentType = "text/plain; charset=utf-8"
        $response.ContentLength64 = $errBytes.Length
        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
    }

    try {
        $response.OutputStream.Close()
    } catch {
        # Handle client connection resets silently
    }
}

$listener.Stop()
$listener.Close()
Write-Host "Server stopped." -ForegroundColor Green
