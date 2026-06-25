param(
    [int]$Port = 30000,

    [string]$DefaultDocument = 'index.html'
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPrefix = $root.TrimEnd('\') + '\'
$mimeTypes = @{
    '.css'  = 'text/css; charset=utf-8'
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $Port)
$listener.Start()

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()

        try {
            $requestBytes = [Collections.Generic.List[byte]]::new()
            $tail = ''

            while ($tail -ne "`r`n`r`n") {
                $value = $stream.ReadByte()
                if ($value -lt 0) {
                    break
                }

                $requestBytes.Add([byte]$value)
                $tail = ($tail + [char]$value)
                if ($tail.Length -gt 4) {
                    $tail = $tail.Substring($tail.Length - 4)
                }
            }

            $requestLine = ([Text.Encoding]::ASCII.GetString($requestBytes.ToArray()) -split "`r`n")[0]
            $requestTarget = ($requestLine -split ' ')[1]
            $requestPath = [Uri]::UnescapeDataString(($requestTarget -split '\?')[0].TrimStart('/'))

            if ([string]::IsNullOrWhiteSpace($requestPath)) {
                $requestPath = $DefaultDocument
            }

            $relativePath = $requestPath.Replace('/', [IO.Path]::DirectorySeparatorChar)
            $filePath = [IO.Path]::GetFullPath((Join-Path $root $relativePath))

            if (-not $filePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or
                -not [IO.File]::Exists($filePath)) {
                $status = '404 Not Found'
                $contentType = 'text/plain; charset=utf-8'
                $body = [Text.Encoding]::UTF8.GetBytes('Not found')
            }
            else {
                $status = '200 OK'
                $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
                $contentType = if ($mimeTypes.ContainsKey($extension)) {
                    $mimeTypes[$extension]
                }
                else {
                    'application/octet-stream'
                }
                $body = [IO.File]::ReadAllBytes($filePath)
            }

            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
            $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($body, 0, $body.Length)
        }
        finally {
            $stream.Dispose()
            $client.Dispose()
        }
    }
}
finally {
    $listener.Stop()
}
