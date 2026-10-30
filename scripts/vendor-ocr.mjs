import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const destination=path.join(root,'vendor/ocr');
fs.mkdirSync(destination,{recursive:true});
const files=[
  ['tesseract.js/dist/tesseract.esm.min.js','tesseract.esm.min.js'],
  ['tesseract.js/dist/worker.min.js','worker.min.js'],
  ['tesseract.js/dist/worker.min.js.LICENSE.txt','worker.LICENSE.txt'],
  ['tesseract.js/dist/tesseract.min.js.LICENSE.txt','bundle.LICENSE.txt'],
  ['tesseract.js/LICENSE.md','TESSERACT-LICENSE'],
  ['tesseract.js-core/LICENSE','CORE-LICENSE'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','eng.traineddata.gz'],
];
for(const file of fs.readdirSync(path.join(root,'node_modules/tesseract.js-core'))) {
  if(/^tesseract-core(?:-(?:simd|relaxedsimd))?(?:-lstm)?\.wasm\.js$/.test(file)) files.push([`tesseract.js-core/${file}`,file]);
}
for(const [source,target] of files)fs.copyFileSync(path.join(root,'node_modules',source),path.join(destination,target));
console.log(`Copied ${files.length} OCR assets and license files. No CDN is used by the app.`);
