param(
    [string]$MarkdownPath = 'docs\rapport-hachage-mots-de-passe-pos2.md',
    [string]$DocxPath = 'docs\rapport-hachage-mots-de-passe-pos2.docx',
    [string]$PdfPath = 'docs\rapport-hachage-mots-de-passe-pos2.pdf',
    [string]$HtmlPath = 'docs\rapport-hachage-mots-de-passe-pos2.html'
)

$ErrorActionPreference = 'Stop'

function Escape-Xml {
    param([string]$Text)
    return [System.Security.SecurityElement]::Escape($Text)
}

function Clean-InlineMarkdown {
    param([string]$Text)
    return $Text.Replace('**', '').Replace('`', '')
}

function New-WordParagraph {
    param(
        [string]$Text,
        [string]$Style = '',
        [bool]$Code = $false,
        [bool]$Bullet = $false
    )

    $safeText = Escape-Xml (Clean-InlineMarkdown $Text)
    $styleXml = ''
    if ($Style) {
        $styleXml = '<w:pStyle w:val="' + $Style + '"/>'
    }

    $bulletXml = ''
    if ($Bullet) {
        $bulletXml = '<w:ind w:left="720" w:hanging="360"/>'
        $safeText = ([char]8226) + ' ' + $safeText
    }

    $runStyle = ''
    if ($Code) {
        $runStyle = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/></w:rPr>'
    }

    return '<w:p><w:pPr>' + $styleXml + $bulletXml + '</w:pPr><w:r>' + $runStyle + '<w:t xml:space="preserve">' + $safeText + '</w:t></w:r></w:p>'
}

function New-HtmlLine {
    param([string]$Line)

    $safe = [System.Net.WebUtility]::HtmlEncode((Clean-InlineMarkdown $Line))
    $trimmed = $Line.Trim()

    if ($trimmed.StartsWith('# ')) {
        return '<h1>' + [System.Net.WebUtility]::HtmlEncode((Clean-InlineMarkdown $trimmed.Substring(2))) + '</h1>'
    }
    if ($trimmed.StartsWith('## ')) {
        return '<h2>' + [System.Net.WebUtility]::HtmlEncode((Clean-InlineMarkdown $trimmed.Substring(3))) + '</h2>'
    }
    if ($trimmed.StartsWith('### ')) {
        return '<h3>' + [System.Net.WebUtility]::HtmlEncode((Clean-InlineMarkdown $trimmed.Substring(4))) + '</h3>'
    }
    if ($trimmed.StartsWith('- ')) {
        return '<li>' + [System.Net.WebUtility]::HtmlEncode((Clean-InlineMarkdown $trimmed.Substring(2))) + '</li>'
    }
    if ($trimmed.StartsWith('|')) {
        return '<pre class="table-line">' + $safe + '</pre>'
    }
    if ($trimmed.Length -eq 0) {
        return '<p class="spacer"></p>'
    }
    if ($trimmed -eq '---') {
        return '<hr />'
    }

    return '<p>' + $safe + '</p>'
}

$projectRoot = (Resolve-Path '.').Path
$sourcePath = Join-Path $projectRoot $MarkdownPath
$targetDocx = Join-Path $projectRoot $DocxPath
$targetPdf = Join-Path $projectRoot $PdfPath
$targetHtml = Join-Path $projectRoot $HtmlPath

if (!(Test-Path $sourcePath)) {
    throw "Rapport Markdown introuvable: $sourcePath"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$lines = Get-Content -Path $sourcePath -Encoding UTF8
$wordParagraphs = New-Object System.Collections.Generic.List[string]
$htmlParts = New-Object System.Collections.Generic.List[string]
$inCode = $false
$htmlCodeBuffer = New-Object System.Collections.Generic.List[string]

foreach ($line in $lines) {
    $trimmed = $line.Trim()

    if ($trimmed.StartsWith('```')) {
        if (-not $inCode) {
            $inCode = $true
            $htmlCodeBuffer.Clear()
        } else {
            $codeText = ($htmlCodeBuffer -join "`n")
            $htmlParts.Add('<pre><code>' + $codeText + '</code></pre>') | Out-Null
            $inCode = $false
        }
        continue
    }

    if ($inCode) {
        $wordParagraphs.Add((New-WordParagraph -Text $line -Code $true)) | Out-Null
        $htmlCodeBuffer.Add([System.Net.WebUtility]::HtmlEncode($line)) | Out-Null
        continue
    }

    if ($trimmed.StartsWith('# ')) {
        $wordParagraphs.Add((New-WordParagraph -Text $trimmed.Substring(2) -Style 'Title')) | Out-Null
    } elseif ($trimmed.StartsWith('## ')) {
        $wordParagraphs.Add((New-WordParagraph -Text $trimmed.Substring(3) -Style 'Heading1')) | Out-Null
    } elseif ($trimmed.StartsWith('### ')) {
        $wordParagraphs.Add((New-WordParagraph -Text $trimmed.Substring(4) -Style 'Heading2')) | Out-Null
    } elseif ($trimmed.StartsWith('- ')) {
        $wordParagraphs.Add((New-WordParagraph -Text $trimmed.Substring(2) -Bullet $true)) | Out-Null
    } elseif ($trimmed.StartsWith('|')) {
        $wordParagraphs.Add((New-WordParagraph -Text $trimmed -Code $true)) | Out-Null
    } elseif ($trimmed -eq '---' -or $trimmed.Length -eq 0) {
        $wordParagraphs.Add((New-WordParagraph -Text '')) | Out-Null
    } else {
        $wordParagraphs.Add((New-WordParagraph -Text $line)) | Out-Null
    }

    $htmlParts.Add((New-HtmlLine -Line $line)) | Out-Null
}

$html = @"
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport - Hachage de mots de passe POS2</title>
  <style>
    @page { size: A4; margin: 22mm 18mm; }
    body { font-family: Calibri, Arial, sans-serif; color: #1d1d1d; line-height: 1.45; }
    h1 { font-size: 28px; margin: 0 0 18px; color: #2f1d19; }
    h2 { font-size: 22px; margin: 26px 0 10px; color: #2f1d19; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    h3 { font-size: 17px; margin: 18px 0 8px; color: #2f1d19; }
    p { margin: 0 0 8px; }
    li { margin: 4px 0 4px 20px; }
    pre { background: #f4f1e8; border: 1px solid #ded6c2; border-radius: 6px; padding: 10px; white-space: pre-wrap; font-family: Consolas, monospace; font-size: 12px; }
    .table-line { margin: 2px 0; background: #faf7ef; border: 0; padding: 2px 6px; }
    hr { border: 0; border-top: 1px solid #ddd; margin: 18px 0; }
    .spacer { height: 6px; }
  </style>
</head>
<body>
$($htmlParts -join "`n")
</body>
</html>
"@

[System.IO.File]::WriteAllText($targetHtml, $html, $utf8NoBom)

$tempRoot = Join-Path $env:TEMP ('pos2-docx-' + [guid]::NewGuid().ToString('N'))
$wordDir = Join-Path $tempRoot 'word'
$relsDir = Join-Path $tempRoot '_rels'
New-Item -ItemType Directory -Path $wordDir -Force | Out-Null
New-Item -ItemType Directory -Path $relsDir -Force | Out-Null

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    $($wordParagraphs -join "`n")
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

$stylesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="2F1D19"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2F1D19"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="2F1D19"/></w:rPr></w:style>
</w:styles>
"@

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
"@

$relsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"@

[System.IO.File]::WriteAllText((Join-Path $wordDir 'document.xml'), $documentXml, $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $wordDir 'styles.xml'), $stylesXml, $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $tempRoot '[Content_Types].xml'), $contentTypesXml, $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $relsDir '.rels'), $relsXml, $utf8NoBom)

if (Test-Path $targetDocx) { Remove-Item -LiteralPath $targetDocx -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempRoot, $targetDocx)
Remove-Item -LiteralPath $tempRoot -Recurse -Force

$edgeCandidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)

$browser = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($browser) {
    if (Test-Path $targetPdf) { Remove-Item -LiteralPath $targetPdf -Force }
    $htmlUri = (New-Object System.Uri($targetHtml)).AbsoluteUri
    & $browser --headless --disable-gpu --print-to-pdf="$targetPdf" $htmlUri | Out-Null
}

Write-Output "DOCX: $targetDocx"
Write-Output "HTML: $targetHtml"
if (Test-Path $targetPdf) {
    Write-Output "PDF: $targetPdf"
} else {
    Write-Output "PDF non genere: navigateur headless introuvable."
}
