param(
    [Parameter(Mandatory = $true)]
    [string]$GithubUser,

    [string]$Repository = 'SITE-ANIV-EMELINE'
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicUrl = "https://$GithubUser.github.io/$Repository/message.html"
$config = @"
window.SUPABASE_URL = "https://eagwyjzlpkjtsohjccod.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZ3d5anpscGtqdHNvaGpjY29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODM5NjksImV4cCI6MjA5NTU1OTk2OX0.mHOilXcHo_di91tA4LK0HC3St86hKwEm3AGAyPeCMZA";
window.MESSAGE_PAGE_URL = "$publicUrl";
"@

Set-Content -Path (Join-Path $root 'supabase-config.js') -Value $config -Encoding utf8
Set-Content -Path (Join-Path $root 'docs\supabase-config.js') -Value $config -Encoding utf8

Write-Host "URL des messages configuree : $publicUrl"
Write-Host "Page principale locale : http://localhost:30000/"
