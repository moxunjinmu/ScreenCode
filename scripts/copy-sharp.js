const fs = require('fs');
const path = require('path');

// 复制 sharp 和 @img 到 Vite 输出目录
const sourceDir = path.join(__dirname, '..', 'node_modules');
const targetDir = path.join(__dirname, '..', '.vite', 'build', 'node_modules');

const depsToCopy = ['sharp', '@img'];

for (const dep of depsToCopy) {
  const src = path.join(sourceDir, dep);
  const dest = path.join(targetDir, dep);
  
  if (fs.existsSync(src)) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      console.log(`Copied ${dep} to Vite output`);
    }
  } else {
    console.warn(`Warning: ${dep} not found in node_modules`);
  }
}

console.log('Dependencies copied successfully');
