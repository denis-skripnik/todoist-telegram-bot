import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
test('real updated grammY with whole app: start, language, projects, state, access control',()=>{
 const dir=mkdtempSync(join(tmpdir(),'todoist-menu-'));
 try{const r=spawnSync(process.execPath,['--experimental-loader',fileURLToPath(new URL('./support/menu-loader.mjs',import.meta.url)),fileURLToPath(new URL('./support/menu-smoke.mjs',import.meta.url))],{cwd:dir,encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH,HOME:dir}});assert.equal(r.status,0,r.stderr+'\n'+r.stdout);assert.match(r.stdout,/REAL_ENTRYPOINT_MENU_STATE_SMOKE_OK/)}finally{rmSync(dir,{recursive:true,force:true})}
});
