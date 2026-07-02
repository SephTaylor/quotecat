#!/bin/bash
# Build a QuoteCat-branded PDF from a markdown flow doc.
# Usage: ./docs/build-flow-doc-pdf.sh [basename]
#   basename defaults to end-to-end-flow-for-mike (backward-compat).
#   Reads docs/{basename}.md, writes docs/{basename}.html and .pdf.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASENAME="${1:-end-to-end-flow-for-mike}"
MD="$REPO_ROOT/docs/${BASENAME}.md"
HTML="$REPO_ROOT/docs/${BASENAME}.html"
PDF="$REPO_ROOT/docs/${BASENAME}.pdf"

if [ ! -f "$MD" ]; then
  echo "Error: $MD not found"
  exit 1
fi
LOGO_SRC="$REPO_ROOT/website/apple-touch-icon.png"
LOGO_B64="$(base64 < "$LOGO_SRC" | tr -d '\n')"

CONTENT_HTML="$(python3 -c "
import sys, markdown
with open('$MD', 'r') as f: text = f.read()
print(markdown.markdown(text, extensions=['tables', 'fenced_code']))
")"

cat > "$HTML" <<HTML_EOF
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>QuoteCat — Project Flow</title>
<style>
  @page { size: letter; margin: 0.7in 0.75in; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #111;
    font-size: 11pt;
    line-height: 1.5;
    margin: 0;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 16px;
    border-bottom: 3px solid #F97316;
    margin-bottom: 24px;
  }
  .header img { width: 48px; height: 48px; }
  .header .brand-text { display: flex; flex-direction: column; }
  .header .brand-name { font-weight: 800; font-size: 16pt; color: #111; line-height: 1; }
  .header .brand-tag { font-size: 9pt; color: #666; margin-top: 4px; }
  h1 {
    color: #111;
    font-size: 22pt;
    margin-top: 0;
    margin-bottom: 6px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }
  h2 {
    color: #111;
    font-size: 14pt;
    margin-top: 28px;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #eee;
    font-weight: 700;
  }
  p { margin: 8px 0; }
  strong { color: #111; font-weight: 700; }
  em { color: #444; }
  code {
    background: #f5f5f5;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 9.5pt;
    color: #c2410c;
  }
  pre {
    background: #1a1a1a;
    color: #f5f5f5;
    padding: 14px 16px;
    border-radius: 6px;
    font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 9pt;
    line-height: 1.45;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  pre code { background: none; color: inherit; padding: 0; }
  blockquote {
    background: #fff7ed;
    border-left: 4px solid #F97316;
    margin: 14px 0;
    padding: 12px 16px;
    border-radius: 0 6px 6px 0;
    page-break-inside: avoid;
  }
  blockquote p { margin: 4px 0; }
  blockquote strong { color: #c2410c; }
  ul, ol { padding-left: 22px; margin: 8px 0; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #eee; margin: 28px 0; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 14px 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #e5e5e5;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f7f7f7; font-weight: 700; color: #111; }
  tr:nth-child(even) td { background: #fafafa; }
  .footer {
    margin-top: 36px;
    padding-top: 14px;
    border-top: 1px solid #eee;
    font-size: 9pt;
    color: #888;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="header">
    <img src="data:image/png;base64,${LOGO_B64}" alt="QuoteCat">
    <div class="brand-text">
      <div class="brand-name">QuoteCat</div>
      <div class="brand-tag">Quoting for trades</div>
    </div>
  </div>
  ${CONTENT_HTML}
  <div class="footer">QuoteCat — quotecat.ai · hello@quotecat.ai</div>
</body>
</html>
HTML_EOF

# Use Chrome headless to render HTML → PDF
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless \
  --disable-gpu \
  --no-sandbox \
  --print-to-pdf="$PDF" \
  --print-to-pdf-no-header \
  --no-pdf-header-footer \
  "file://$HTML" 2>&1 | grep -v "^$" | grep -v "DevTools" | head -3 || true

echo "PDF: $PDF"
ls -la "$PDF" 2>&1 | tail -1
