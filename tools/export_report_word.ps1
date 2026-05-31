param(
    [string]$MarkdownPath = "docs\rapport-hachage-mots-de-passe-pos2.md",
    [string]$DocxPath = "docs\rapport-hachage-mots-de-passe-pos2.docx",
    [string]$PdfPath = "docs\rapport-hachage-mots-de-passe-pos2.pdf"
)

$ErrorActionPreference = "Stop"

function Add-Paragraph {
    param(
        [object]$Document,
        [string]$Text = "",
        [string]$Style = "",
        [int]$Size = 11,
        [bool]$Bold = $false,
        [string]$Font = "Calibri",
        [int]$SpaceAfter = 6
    )

    $paragraph = $Document.Paragraphs.Add()
    $range = $paragraph.Range
    $range.Text = $Text
    $range.Font.Name = $Font
    $range.Font.Size = $Size
    $range.Font.Bold = [int]$Bold
    $paragraph.SpaceAfter = $SpaceAfter

    if ($Style) {
        try { $range.Style = $Style } catch {}
    }

    $range.InsertParagraphAfter() | Out-Null
    return $paragraph
}

function Clean-MarkdownText {
    param([string]$Text)
    return $Text.Replace('**', '').Replace('`', '')
}

$projectRoot = (Resolve-Path ".").Path
$sourcePath = Join-Path $projectRoot $MarkdownPath
$targetDocx = Join-Path $projectRoot $DocxPath
$targetPdf = Join-Path $projectRoot $PdfPath

if (!(Test-Path $sourcePath)) {
    throw "Rapport Markdown introuvable: $sourcePath"
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $document = $word.Documents.Add()
    $document.PageSetup.TopMargin = 56.7
    $document.PageSetup.BottomMargin = 56.7
    $document.PageSetup.LeftMargin = 56.7
    $document.PageSetup.RightMargin = 56.7

    $selection = $word.Selection

    $lines = Get-Content -Path $sourcePath -Encoding UTF8
    $inCode = $false
    $codeBuffer = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        if ($line.Trim().StartsWith('```')) {
            if (-not $inCode) {
                $inCode = $true
                $codeBuffer.Clear()
            } else {
                $codeText = ($codeBuffer -join [Environment]::NewLine)
                if ($codeText.Trim().Length -gt 0) {
                    $paragraph = Add-Paragraph -Document $document -Text $codeText -Size 9 -Font "Consolas" -SpaceAfter 10
                    $paragraph.Range.Shading.BackgroundPatternColor = 15132390
                    $paragraph.LeftIndent = 18
                    $paragraph.RightIndent = 18
                }
                $inCode = $false
            }
            continue
        }

        if ($inCode) {
            $codeBuffer.Add($line) | Out-Null
            continue
        }

        $trimmed = $line.Trim()

        if ($trimmed.Length -eq 0) {
            Add-Paragraph -Document $document -Text "" -SpaceAfter 2 | Out-Null
            continue
        }

        if ($trimmed -eq "---") {
            Add-Paragraph -Document $document -Text "" -SpaceAfter 8 | Out-Null
            continue
        }

        if ($trimmed.StartsWith("# ")) {
            Add-Paragraph -Document $document -Text (Clean-MarkdownText $trimmed.Substring(2)) -Style "Title" -Size 22 -Bold $true -SpaceAfter 14 | Out-Null
            continue
        }

        if ($trimmed.StartsWith("## ")) {
            Add-Paragraph -Document $document -Text (Clean-MarkdownText $trimmed.Substring(3)) -Style "Heading 1" -Size 17 -Bold $true -SpaceAfter 10 | Out-Null
            continue
        }

        if ($trimmed.StartsWith("### ")) {
            Add-Paragraph -Document $document -Text (Clean-MarkdownText $trimmed.Substring(4)) -Style "Heading 2" -Size 14 -Bold $true -SpaceAfter 8 | Out-Null
            continue
        }

        if ($trimmed.StartsWith("- ")) {
            $paragraph = Add-Paragraph -Document $document -Text (Clean-MarkdownText $trimmed.Substring(2)) -Size 11 -SpaceAfter 3
            $paragraph.Range.ListFormat.ApplyBulletDefault() | Out-Null
            continue
        }

        if ($trimmed.StartsWith("|")) {
            $paragraph = Add-Paragraph -Document $document -Text (Clean-MarkdownText $trimmed) -Size 9 -Font "Consolas" -SpaceAfter 2
            $paragraph.Range.Shading.BackgroundPatternColor = 15987699
            continue
        }

        Add-Paragraph -Document $document -Text (Clean-MarkdownText $line) -Size 11 -SpaceAfter 6 | Out-Null
    }

    $document.SaveAs2($targetDocx, 16)
    $document.ExportAsFixedFormat($targetPdf, 17)
    $document.Close([ref]$false)
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output "DOCX: $targetDocx"
Write-Output "PDF: $targetPdf"
