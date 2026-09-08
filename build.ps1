# Fabrication du paquet INTERCEPTOR - cree par NeoZ
#   .\build.ps1            -> dist/interceptor-<version>.xpi
#   .\build.ps1 -Verify    -> verifie seulement, ne construit pas

param([switch]$Verify)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$manifest = Get-Content 'manifest.json' -Raw | ConvertFrom-Json
$version  = $manifest.version
Write-Host "INTERCEPTOR $version - by NeoZ" -ForegroundColor DarkYellow

# --- Verification d integrite -------------------------------------------------
$required = @(
  'manifest.json',
  'background/background.html',
  'background/background.js',
  'background/api/rpc.js',
  'background/api/status.js',
  'background/api/files.js',
  'background/api/tooling.js',
  'background/api/replay.js',
  'background/api/surface.js',
  'background/core/config.js',
  'background/core/store.js',
  'background/core/dedup.js',
  'background/core/analyzer.js',
  'background/core/analyzer-regles.js',
  'background/core/secrets.js',
  'background/core/debug.js',
  'background/core/persist.js',
  'background/capture/webrequest.js',
  'background/capture/streamfilter.js',
  'background/capture/bodies.js',
  'background/capture/security.js',
  'background/capture/dnsinfo.js',
  'background/capture/navigation.js',
  'background/capture/cookies.js',
  'background/capture/proxy.js',
  'background/capture/probe.js',
  'background/ingest/page.js',
  'background/ingest/promote.js',
  'background/ingest/har.js',
  'background/ingest/curl.js',
  'background/rules/engine.js',
  'background/rules/intercept.js',
  'background/export/har.js',
  'background/export/report.js',
  'background/export/codegen.js',
  'background/export/codegen-util.js',
  'background/export/codegen-clients.js',
  'background/export/postman.js',
  'background/export/save.js',
  'background/lib/util.js',
  'background/lib/emitter.js',
  'content/bridge.js',
  'content/hooks.js',
  'ui/theme.css',
  'ui/app.js',
  'ui/console.html',
  'ui/console.css',
  'ui/console.js',
  'ui/popup.html',
  'ui/popup.css',
  'ui/popup.js',
  'ui/lib/dom.js',
  'ui/lib/format.js',
  'ui/lib/filters.js',
  'ui/lib/columns.js',
  'ui/lib/i18n.js',
  'ui/lib/dict-en.js',
  'ui/lib/dict-en-menus.js',
  'ui/lib/dict-en-tools.js',
  'ui/lib/codecs.js',
  'ui/lib/bytes.js',
  'ui/lib/codecs-bases.js',
  'ui/lib/codecs-text.js',
  'ui/lib/codecs-format.js',
  'ui/lib/codecs-web.js',
  'ui/lib/catalogue.js',
  'ui/lib/hashes.js',
  'ui/lib/hashes-plus.js',
  'ui/lib/sha3.js',
  'ui/lib/blake2.js',
  'ui/lib/sommes.js',
  'ui/lib/empreintes-tout.js',
  'ui/lib/otp.js',
  'ui/lib/obfuscation.js',
  'ui/lib/obfuscation-lire.js',
  'ui/lib/jwt.js',
  'ui/lib/crypto-outils.js',
  'ui/lib/binaires.js',
  'ui/lib/asn1.js',
  'ui/lib/charsets.js',
  'ui/lib/entetes-analyse.js',
  'ui/lib/net-plus.js',
  'ui/lib/ref-reseau.js',
  'ui/lib/diff.js',
  'ui/lib/motifs.js',
  'ui/lib/entites-html.js',
  'ui/lib/dict-en-panneaux2.js',
  'ui/lib/dict-en-reseau.js',
  'ui/lib/dict-en-console.js',
  'ui/lib/dict-en-alertes.js',
  'ui/lib/dict-en-code.js',
  'ui/console/dock.js',
  'ui/console/tools-code.js',
  'ui/console/tools-otp.js',
  'ui/console/tools-crypto.js',
  'ui/console/tools-binaire.js',
  'ui/console/tools-entetes.js',
  'ui/console/tools-diff.js',
  'ui/console/tools-chercher.js',
  'ui/lib/net.js',
  'ui/lib/temps.js',
  'ui/lib/generateurs.js',
  'ui/lib/ref-http.js',
  'ui/lib/ref-entetes.js',
  'ui/lib/ref-mime.js',
  'ui/lib/ref-ports.js',
  'ui/lib/dict-en-outils.js',
  'ui/lib/dict-en-panneaux.js',
  'ui/lib/dict-en-ref-http.js',
  'ui/lib/dict-en-ref-entetes.js',
  'ui/lib/dict-en-ref-reseau.js',
  'ui/console/tools-temps.js',
  'ui/console/tools-generer.js',
  'ui/console/tools-import.js',
  'ui/console/tools-reseau.js',
  'ui/console/tools-reference.js',
  'ui/console/tools-chiffres.js',
  'ui/lib/inspect.js',
  'ui/console/requests.js',
  'ui/console/detail.js',
  'ui/console/detail-parts.js',
  'ui/console/detail-more.js',
  'ui/console/rowmenu.js',
  'ui/console/rowsize.js',
  'ui/console/statusbar.js',
  'ui/console/header.js',
  'ui/console/replay.js',
  'ui/console/alerts.js',
  'ui/console/streams.js',
  'ui/console/journal.js',
  'ui/console/stats.js',
  'ui/console/rules.js',
  'ui/console/settings.js',
  'ui/console/settings-groups.js',
  'ui/console/help.js',
  'ui/console/tutorial.js',
  'ui/console/summary.js',
  'ui/console/compare.js',
  'ui/console/tools.js',
  'ui/console/tools-panels.js',
  'ui/console/sitemap.js',
  'ui/console/debug.js',
  'ui/console/intercept.js',
  'ui/console/content-en.js',
  'ui/console/content-fr.js',
  'icons/icon.svg'
)
$missing = $required | Where-Object { -not (Test-Path $_) }
if ($missing) {
  Write-Host "Fichiers manquants :" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}

# Les surfaces declarees dans le manifest doivent exister sur le disque.
$surfaces = @(
  $manifest.background.page,
  $manifest.browser_action.default_popup,
  $manifest.sidebar_action.default_panel,
  $manifest.options_ui.page
) | Where-Object { $_ }
$badSurface = $surfaces | Where-Object { -not (Test-Path $_) }
if ($badSurface) {
  Write-Host "Surface declaree dans le manifest mais absente :" -ForegroundColor Red
  $badSurface | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}

$jsCount  = (Get-ChildItem -Recurse -Filter *.js  | Where-Object { $_.FullName -notlike '*\dist\*' }).Count
$allFiles = Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notlike '*\dist\*' }
Write-Host "  $($required.Count) fichiers requis presents"
Write-Host "  $jsCount modules JavaScript"
Write-Host "  $($allFiles.Count) fichiers au total"
Write-Host "  surfaces : popup, panneau lateral, console plein ecran, page d options"

# Les tests du noyau tournent sans navigateur : on les lance si Node est present.
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  Write-Host "`nTests du noyau :" -ForegroundColor DarkGray
  & node 'tests/core.test.mjs'
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Les tests du noyau echouent : construction interrompue." -ForegroundColor Red
    exit 1
  }

  Write-Host "`nExhaustivite de l affichage :" -ForegroundColor DarkGray
  & node 'tests/detail-coverage.test.mjs'
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Un champ capture n est pas affiche : construction interrompue." -ForegroundColor Red
    exit 1
  }

  Write-Host "`nChargement de l interface :" -ForegroundColor DarkGray
  & node 'tests/ui-load.test.mjs'
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Un module d interface ne se charge pas : construction interrompue." -ForegroundColor Red
    exit 1
  }

  Write-Host "`nBoite a outils :" -ForegroundColor DarkGray
  & node 'tests/outils.test.mjs'
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Un outil ne rend pas la valeur attendue : construction interrompue." -ForegroundColor Red
    exit 1
  }
  Write-Host "`nOutils avances :" -ForegroundColor DarkGray
  & node 'tests/avance.test.mjs'
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Un outil avance ne rend pas la valeur attendue : construction interrompue." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "  (Node absent : tests du noyau ignores)" -ForegroundColor DarkGray
}

if ($Verify) { Write-Host "`nVerification terminee." -ForegroundColor Green; exit 0 }

# --- Assemblage ---------------------------------------------------------------
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist '_stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$include = @('manifest.json', 'background', 'content', 'ui', 'icons')
foreach ($item in $include) {
  Copy-Item $item -Destination $stage -Recurse -Force
}

$xpi = Join-Path $dist "interceptor-$version.xpi"
if (Test-Path $xpi) { Remove-Item $xpi -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath "$xpi.zip" -CompressionLevel Optimal -Force
Move-Item "$xpi.zip" $xpi -Force
Remove-Item $stage -Recurse -Force

$size = [math]::Round((Get-Item $xpi).Length / 1KB, 1)
Write-Host ""
Write-Host "Paquet : $xpi  ($size Ko)" -ForegroundColor Green
Write-Host "Chargement : about:debugging#/runtime/this-firefox -> Charger un module temporaire" -ForegroundColor DarkGray
