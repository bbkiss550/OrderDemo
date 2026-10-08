# Dot-source this script: . .\use-java.ps1
$jdkHomeFile = Join-Path $PSScriptRoot '.runtime\java\jdk-home.txt'
if (-not (Test-Path -LiteralPath $jdkHomeFile)) {
    throw 'Project JDK has not been installed.'
}
$projectJdkHome = (Get-Content -LiteralPath $jdkHomeFile -Raw).Trim()
if (-not (Test-Path -LiteralPath (Join-Path $projectJdkHome 'bin\javac.exe'))) {
    throw 'Project JDK is missing javac.exe.'
}
$env:JAVA_HOME = $projectJdkHome
$env:PATH = (Join-Path $projectJdkHome 'bin') + [IO.Path]::PathSeparator + $env:PATH
Write-Host "Project JAVA_HOME: $projectJdkHome"
