# ===========================
# MasterHIT – Update & Deploy
# ===========================
# Requisitos:
# - Guardar el CSV como UTF-8 (Excel: "CSV UTF-8 (delimitado por comas)")
# - Tener git instalado y el repo ya configurado con origin/main

# ==== Configuración ====
$ProjectPath = "C:\Users\jorgg\OneDrive\MasterHIT"
$Branch      = "main"
$Remote      = "origin"
$PagesUrl    = "https://shoppernerds.github.io/masterhit/"

# Archivos a los que daremos preferencia local si hay conflictos
$PreferLocalOnConflict = @(
  "masterhit-products.csv",
  "masterhit-products.json"
)

# ==== Utilidades ====
function Run($cmd) {
  Write-Host "› $cmd" -ForegroundColor DarkGray
  & powershell -NoProfile -Command $cmd
  if ($LASTEXITCODE -ne 0) { throw "Fallo al ejecutar: $cmd" }
}

# Mensaje visible
function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Ok($msg)   { Write-Host $msg -ForegroundColor Green }
function Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Err($msg)  { Write-Host $msg -ForegroundColor Red }

# ==== Ir a la carpeta del proyecto ====
Set-Location $ProjectPath

try {
  Info "1) Convirtiendo CSV → JSON (UTF-8)…"
  Get-Content masterhit-products.csv `
    | ConvertFrom-Csv `
    | ConvertTo-Json -Depth 5 `
    | Set-Content masterhit-products.json -Encoding UTF8
  Ok "CSV convertido a JSON."

  # ==== Validación de imágenes ====
  Info "2) Validando imágenes referenciadas…"
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
    Warn "Imágenes faltantes en /img/:"
    $unique | ForEach-Object { Warn " - $_" }
  } else {
    Ok "Todas las imágenes referenciadas existen."
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

  # ==== Sincronizar con remoto (rebase + autostash) ====
  Info "5) Sincronizando con remoto ($Remote/$Branch)…"
  try {
    Run "git pull $Remote $Branch --rebase --autostash"
  } catch {
    Warn "Se detectaron conflictos durante el rebase. Intentando resolver con tu versión local…"
    # Resolver conflictos automáticamente para los archivos preferidos
    foreach ($file in $PreferLocalOnConflict) {
      if (Test-Path $file) {
        # Si está en conflicto, preferimos nuestra versión local
        & git checkout --ours -- $file *>$null
        & git add $file *>$null
      }
    }
    # Continuar rebase (si queda algo sin resolver se detendrá)
    Run "git rebase --continue"
  }

  # ==== Push ====
  Info "6) Publicando (git push)…"
  $push = & git push $Remote $Branch 2>&1
  if ($LASTEXITCODE -ne 0) {
    Warn "Push normal rechazado, reintentando con --force-with-lease…"
    Run "git push $Remote $Branch --force-with-lease"
  } else {
    $push | Out-Null
  }
  Ok "Cambios subidos correctamente."

  # ==== Abrir sitio con cache-buster ====
  $ts = [int][double]::Parse((Get-Date -UFormat %s))
  $url = "$PagesUrl?_=$ts"
  Info "7) Abriendo sitio: $url"
  Start-Process $url

} catch {
  Err "❌ Error: $($_.Exception.Message)"
  Err "Revisa los pasos anteriores. Si el rebase quedó a medias, puedes abortarlo con: git rebase --abort"
  exit 1
}

