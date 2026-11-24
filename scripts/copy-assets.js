const fs = require('fs');
const path = require('path');

const srcWebview = path.resolve(__dirname, '..', 'src', 'webview');
const outWebview = path.resolve(__dirname, '..', 'out', 'webview');

if (!fs.existsSync(outWebview)) {
  fs.mkdirSync(outWebview, { recursive: true });
}

if (fs.existsSync(srcWebview)) {
  const files = fs.readdirSync(srcWebview);
  for (const file of files) {
    const srcFile = path.join(srcWebview, file);
    const destFile = path.join(outWebview, file);
    fs.copyFileSync(srcFile, destFile);
  }
  console.log(`Copied ${files.length} webview assets to out/webview`);
}
