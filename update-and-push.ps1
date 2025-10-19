# ===========================
# MasterHIT – Update & Deploy
# ===========================
# Requisitos:
# - Guardar los CSV como UTF-8 (Excel: "CSV UTF-8 (delimitado por comas)")
# - Tener git instalado y el repo configurado con origin/main
# - Carpeta del proyecto debe contener /img/, /index.html, JSONs y CSVs

# ==== Configuración ====
$ProjectPath = "C:\Users\jorgg\OneDrive\MasterHIT"
$Branch      = "main"
$Remote      = "origin"
$PagesUrl    = "https://shoppernerds.github.io/masterhit/"

# Archivos que preferimos conservar locales en caso de conflicto
$PreferLocalOnConflict = @(
  "masterhit-products.csv",
  "masterhit-products.json",
  "masterhit-singles.csv",
  "masterhit-singles.json"
)

# ==== Utilidades ====
function Run($cmd) {
  Write-Host "› $cmd" -ForegroundColor DarkGray
  & powershell -NoProfile -Command $cmd
  if ($LASTEXITCODE -ne 0) { throw "Fallo al ejecutar: $cmd" }
}

function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Ok($msg)   { Write-Host $msg -ForegroundColor Green }
function Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Err($msg)  { Write-Host $msg -ForegroundColor Red }

# ==== Ir a la carpeta del proyecto ====
Set-Location $ProjectPath

try {
  Info "1) Convirtiendo masterhit-products.csv → JSON (UTF-8)…"
  Get-Content masterhit-products.csv `
    | ConvertFrom-Csv `
    | ConvertTo-Json -Depth 5 `
    | Set-Content masterhit-products.json -Encoding UTF8
  Ok "CSV de productos convertido a JSON."

  Info "1b) Convirtiendo masterhit-singles.csv → JSON (UTF-8)…"
  Get-Content masterhit-singles.csv `
    | ConvertFrom-Csv `
    | ConvertTo-Json -Depth 5 `
    | Set-Content masterhit-singles.json -Encoding UTF8
  Ok "CSV de singles convertido a JSON."

  # ==== Validar imágenes en productos ====
  Info "2) Validando imágenes referenciadas (productos)…"
  $json = Get-Content masterhit-products.json -Raw | ConvertFrom-Json
  $missing = @()
  foreach ($p in $json) {
    if ($p.PSObject.Properties.Name -contains "image") {
      $img = [string]$p.image
      if ($img -and -not (Test-Path (Join-Path $ProjectPath $img))) {
        $missing += $img
      }
    }
  }
  if ($missing.Count -gt 0) {
    $unique = $missing | Sort-Object -Unique
    Warn "Imágenes faltantes en /img/ (productos):"
    $unique | ForEach-Object { Warn " - $_" }
  } else {
    Ok "Todas las imágenes de productos existen."
  }

  # ==== Validar imágenes en singles ====
  Info "2b) Validando imágenes referenciadas (singles)…"
  $jsonSingles = Get-Content masterhit-singles.json -Raw | ConvertFrom-Json
  $missingSingles = @()
  foreach ($p in $jsonSingles) {
    if ($p.PSObject.Properties.Name -contains "image") {
      $img = [string]$p.image
      if ($img -and -not (Test-Path (Join-Path $ProjectPath $img))) {
        $missingSingles += $img
      }
    }
  }
  if ($missingSingles.Count -gt 0) {
    $uniqueS = $missingSingles | Sort-Object -Unique
    Warn "Imágenes faltantes en /img/ (singles):"
    $uniqueS | ForEach-Object { Warn " - $_" }
  } else {
    Ok "Todas las imágenes de singles existen."
  }

  # ==== Git add / commit (solo si hay cambios) ====
  Info "3) Preparando cambios (git add .)…"
  Run "git add ."

  $pending = git status --porcelain
  if ([string]::IsNullOrWhiteSpace($pending)) {
    Warn "No hay cambios para commitear."
  } else {
    $fecha = Get-Date -Format "yyyy-MM-dd HH:mm"
    Info "4) Commit…"
    Run "git commit -m 'Actualización completa ($fecha)'"
  }

  # ==== Sincronizar con remoto ====
  Info "5) Sincronizando con remoto ($Remote/$Branch)…"
  try {
    Run "git pull $Remote $Branch --rebase --autostash"
  } catch {
    Warn "Conflictos detectados, aplicando tu versión local en archivos clave…"
    foreach ($file in $PreferLocalOnConflict) {
      if (Test-Path $file) {
        & git checkout --ours -- $file *>$null
        & git add $file *>$null
      }
    }
    Run "git rebase --continue"
  }

  # ==== Push ====
  Info "6) Subiendo cambios a remoto…"
  $push = & git push $Remote $Branch 2>&1
  if ($LASTEXITCODE -ne 0) {
    Warn "Push normal rechazado, reintentando con --force-with-lease…"
    Run "git push $Remote $Branch --force-with-lease"
  } else {
    $push | Out-Null
  }
  Ok "Cambios subidos correctamente a $Remote/$Branch."

  # ==== Abrir sitio (sin caché) ====
  $ts = [int][double]::Parse((Get-Date -UFormat %s))
  $url = "$PagesUrl?_=$ts"
  Info "7) Abriendo sitio en navegador sin caché…"
  Start-Process "cmd" "/c start msedge --inprivate $url"

  Ok "✅ Deploy completado exitosamente."

} catch {
  Err "❌ Error: $($_.Exception.Message)"
  Err "Si el rebase quedó a medias, ejecuta: git rebase --abort"
  exit 1
}

