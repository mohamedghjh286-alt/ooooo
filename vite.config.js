import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function merkazTxtLibrary() {
  const virtualId = 'virtual:merkaz-laws';
  const resolvedId = '\0' + virtualId;
  const parse = (raw, file) => {
    const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
    const meta = {}; const laws = []; let current = null; let multiline = null; let buffer = [];
    const flush = () => { if (current) { if (multiline) current[multiline] = buffer.join('\n').trim(); laws.push(current); current = null; } multiline = null; buffer = []; };
    for (let i=0;i<lines.length;i++) {
      const line = lines[i]; const trimmed = line.trim();
      if (multiline) { if (trimmed === '>>') { current[multiline] = buffer.join('\n').trim(); multiline = null; buffer = []; } else buffer.push(line); continue; }
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed === '[MERKAZ]') continue;
      if (trimmed === '[LAW]') { flush(); current = {}; continue; }
      const m = line.match(/^([\w-]+)\s*<<\s*$/);
      if (m && current) { multiline = m[1]; buffer = []; continue; }
      const pair = line.match(/^([\w-]+)\s*=\s*(.*)$/);
      if (!pair) throw new Error(`سطر غير مفهوم ${i+1}: ${trimmed}`);
      if (current) current[pair[1]] = pair[2].trim(); else meta[pair[1]] = pair[2].trim();
    }
    if (multiline) throw new Error(`حقل متعدد الأسطر غير مغلق: ${multiline}`);
    flush();
    const requiredMeta = ['version','title','system','grade','track','year','language'];
    const missingMeta = requiredMeta.filter(k => !meta[k]);
    if (missingMeta.length) throw new Error(`بيانات الملف ناقصة: ${missingMeta.join(', ')}`);
    if (!laws.length) throw new Error('الملف لا يحتوي على أي [LAW]');
    const required = ['id','subject','category','title','equation','explanation','symbols','units','example','common_mistakes'];
    const valid = []; const errors = [];
    laws.forEach((law, index) => {
      const missing = required.filter(k => !law[k]);
      if (missing.length) errors.push(`القانون ${index+1}: حقول ناقصة (${missing.join(', ')})`);
      else valid.push({...law, symbols: law.symbols.split('\n').filter(Boolean).map(x=>{const p=x.split('|');return {symbol:(p[0]||'').trim(),meaning:(p[1]||'').trim(),unit:(p[2]||'').trim()}}), sourceFile:file});
    });
    if (errors.length) throw new Error(errors.join(' — '));
    return {...meta, laws:valid, sourceFile:file};
  };
  return {
    name:'merkaz-flat-txt-library',
    resolveId(id){ if(id===virtualId) return resolvedId; },
    load(id){
      if(id!==resolvedId) return null;
      const root = process.cwd();
      const files = fs.readdirSync(root).filter(f=>f.toLowerCase().endsWith('.txt') && f.toLowerCase() !== 'merkaz-template.txt' && !f.startsWith('.')).sort();
      const datasets=[]; const diagnostics=[];
      for(const file of files){
        try { datasets.push(parse(fs.readFileSync(path.join(root,file),'utf8'),file)); }
        catch(e){ diagnostics.push({file,message:e.message}); console.warn(`[MERKAZ TXT] تم تجاهل ${file}: ${e.message}`); }
      }
      return `export const datasets = ${JSON.stringify(datasets)}; export const diagnostics = ${JSON.stringify(diagnostics)};`;
    }
  };
}
export default defineConfig({ plugins:[react(), merkazTxtLibrary()], build:{target:'es2020'}, server:{host:'0.0.0.0'} });
