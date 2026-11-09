import fs from 'node:fs';import path from 'node:path';import url from 'node:url';
const root=path.dirname(url.fileURLToPath(import.meta.url));const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const files={'__CSS__':'src/styles.css','__STUDIO_CSS__':'src/studio.css','__JSZIP__':'vendor/jszip.min.js','__DECIMAL__':'src/decimal.js','__SHA__':'src/sha256.js','__READER__':'src/xlsx-reader.js','__CORE__':'src/core.js','__WRITER__':'src/xlsx-writer.js','__UI__':'src/ui.js','__STORAGE__':'src/studio-storage.js','__LAYOUT__':'src/studio-layout.js','__STUDIO_UI__':'src/studio-ui.js'};
let html=read('template.html');for(const [placeholder,file] of Object.entries(files)){let code=read(file).replaceAll('</script>','<\\/script>');html=html.replace(placeholder,code);}
if(/__JSZIP__|__CORE__|__CSS__/.test(html)||html.includes('src="https:')||html.includes("href=\"https:"))throw Error('Build không tự chứa hoặc còn external link');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist/index.html'),html,'utf8');console.log('Built chatgpt/dist/index.html',Buffer.byteLength(html),'bytes (all inline, no external references)');
