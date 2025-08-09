# $OutputEncoding = [System.Text.Encoding]::UTF8

param(
    [Parameter(Mandatory=$true)]
    [string]$VueFilePath,
    [Parameter(Mandatory=$true)]
    [string]$DestinationPath
)

# Use the script's directory as the base for prompt files
$baseDir = $PSScriptRoot

# Extract the base name of the Vue file path to use as the project name
$projectName = (Get-Item $VueFilePath).Name + "_react"

# Step 1: Importing local Vue project content into prompt.txt
Write-Host "Step 1: Importing local Vue project content into prompt.txt..."
try {
    $body1 = @{ localPath = $VueFilePath } | ConvertTo-Json
    # The API returns the aggregated content, which we now capture and write to prompt.txt
    Invoke-WebRequest -Uri http://localhost:3000/git/import-local-project -Method POST -ContentType "application/json" -Body $body1 -ErrorAction Stop |
        Select-Object -ExpandProperty Content |
        Set-Content -Path (Join-Path $baseDir "prompt.txt") -Encoding UTF8
    Write-Host "prompt.txt file successfully generated at $($baseDir)\prompt.txt"
} catch {
    Write-Error "Step 1 failed: Unable to import local project. Error: $($_.Exception.Message) - $($_.Exception.Response.Content)"
    exit 1
}

# Step 2: Processing prompt.txt using AgentX (Dify), outputting to image/prompt.output.txt
Write-Host "Step 2: Processing prompt.txt using AgentX..."
try {
    Invoke-WebRequest -Uri http://localhost:3000/agentx/process-prompt -Method POST -ErrorAction Stop
    Write-Host "prompt.output.txt file successfully generated at $($baseDir)\prompt.output.txt"
} catch {
    Write-Error "Step 2 failed: Unable to process prompt with AgentX. Error: $($_.Exception.Message) - $($_.Exception.Response.Content)"
    exit 1
}

# Step 3: Converting prompt.output.txt to a React project
Write-Host "Step 3: Converting prompt.output.txt to a React project named $projectName..."
try {
    $sourceFilePathForGenerator = Join-Path $baseDir "prompt.output.txt"
    # The -replace operation removes the final "_react" part from the destination path
    # because the project generator will append the projectName itself.
    $outputDirForGenerator = $DestinationPath -replace "[\\/][^\\/]+_react$", ""
    
    $body3 = @{
        sourceFilePath = $sourceFilePathForGenerator
        projectName    = $projectName
        outputDir      = $outputDirForGenerator
    } | ConvertTo-Json
    Invoke-RestMethod -Uri http://localhost:3001/generate-project -Method Post -ContentType 'application/json' -Body $body3 -ErrorAction Stop
    Write-Host "React project '$projectName' successfully generated in '$($outputDirForGenerator)'!"
} catch {
    Write-Error "Step 3 failed: Unable to generate React project. Error: $($_.Exception.Message) - $($_.Exception.Response.Content)"
    exit 1
}

Write-Host "All instructions executed."