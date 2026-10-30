import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const skillPath = path.join(root,'.agents/skills/design-taste-frontend');

test('design taste skill is vendored as a complete project skill',async()=>{
 const content = await readFile(path.join(skillPath,'SKILL.md'),'utf8');
 assert.match(content,/^---\s*\nname: design-taste-frontend\s*\n/);
 assert.match(content,/references\/app-screens\.md/);
 const files = ['LICENSE','README.md','SKILL.md','UPSTREAM.md',
  'assets/app.css','assets/charts.js',
  'library/app.json','library/directions.json','library/sites.json','library/type.json',
  'references/app-screens.md','references/critique.md','references/motion.md',
  'scripts/draw.mjs','scripts/inspect.mjs','scripts/lint.mjs','scripts/lib/app-draw.mjs'];
 for(const name of files) await access(path.join(skillPath,name));
 const pin = await readFile(path.join(skillPath,'UPSTREAM.md'),'utf8');
 assert.ok(pin.includes('12af471f627f866411b4bd785b19646d3672784c'));
});
