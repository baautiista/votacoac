import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import {setup} from './helpers.mjs';
import demo from '../src/lib/demo-catalog.json' with {type:'json'};
import actual from '../src/lib/catalogue-2027.json' with {type:'json'};
import defaults from '../src/lib/competition-defaults.json' with {type:'json'};
import {bingoLines,trafficLight} from '../server/competition-core.mjs';
const selection = () => ({Coro:[],Comparsa:[],Chirigota:[],Cuarteto:[]});
async function admin(f) { const result=await f.call('/api/auth/register','POST',{email:'admin@example.test',name:'Administrador',password:'A-long-test-password-52'},null,{'oai-authenticated-user-email':'owner@example.test'});assert.equal(result.status,201);return result; }
async function publishConfig(f,cookie,change=()=>{}) {const current=await f.call('/api/admin/modules','GET',undefined,cookie);assert.equal(current.status,200);const config=structuredClone(current.data.config);change(config);const response=await f.call('/api/admin/modules','PUT',{config,expectedRevision:current.data.revision,reason:'Configuración documentada de prueba'},cookie);assert.equal(response.status,200,JSON.stringify(response.data));return response.data.config;}
const future=()=>new Date(Date.now()+86400000).toISOString();
const beforeContest=()=>{const catalog=structuredClone(demo);for(const session of catalog.sessions)for(const p of session.performances)p.actTime='2099-01-01T20:00:00.000Z';return catalog;};

test('additive migration preserves populated legacy accounts, votes, favorites and predictions',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(readFileSync(new URL('../drizzle/0000_pink_marvel_apes.sql',import.meta.url),'utf8'));
 db.prepare('INSERT INTO users(id,email,name,password_hash,recovery_hash,role,created_at) VALUES(?,?,?,?,?,?,?)').run('legacy-user','old@example.test','Old user','fixture-hash','fixture-code','user',1);
 db.prepare('INSERT INTO votes(id,user_id,edition_id,performance_id,group_id,group_name,category,voting_type,score,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('old-vote','legacy-user','coac-2027-demo','old-performance','old-group','Old group','Comparsa','Avanzado',120,1);
 db.prepare('INSERT INTO favorites(user_id,group_id,edition_id) VALUES(?,?,?)').run('legacy-user','old-group','coac-2027-demo');db.prepare('INSERT INTO predictions(id,user_id,edition_id,selection,updated_at) VALUES(?,?,?,?,?)').run('old-prediction','legacy-user','coac-2027-demo','{}',1);
 const originals=Object.fromEntries(['users','votes','favorites','predictions'].map(table=>[table,db.prepare(`SELECT * FROM ${table}`).all()]));
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')&&!n.startsWith('0000')).sort())db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 for(const table of Object.keys(originals))assert.deepEqual(db.prepare(`SELECT * FROM ${table}`).all(),originals[table]);db.close();
});
test('confirmed 2027 catalog exposes 125 source rows and marks incomplete names, without fabricated sessions',async()=>{
 const f=setup(actual);const result=await f.call('/api/state');assert.equal(result.status,200);assert.equal(result.data.catalog.groups.length,125);assert.equal(result.data.catalog.edition.demo,false);assert.equal(result.data.catalog.sessions.length,0);assert.equal(result.data.catalog.groups.filter(g=>g.needsReview).length,20);assert.equal(result.data.counts.votes,0);assert.equal(result.data.competition.windows.semifinales.open,false);assert.equal(result.data.competition.config.fantasy.enabled,false);f.DB.sqlite.close();
});
test('forecast autosave persists ordered choices, rejects forged groups and locks on deadline or publication',async()=>{
 const f=setup();const owner=await admin(f),user=await f.register();const pick={...selection(),Comparsa:['demo-brujula','demo-papel']};
 assert.equal((await f.call('/api/competition/forecast','PUT',{phase:'semifinales',selection:pick},user.cookie)).status,423);
 await publishConfig(f,owner.cookie,c=>{for(const p of ['semifinales','final','ganador'])c.forecasts[p].closesAt=future();});
 assert.equal((await f.call('/api/competition/forecast','PUT',{phase:'semifinales',selection:pick,points:9999},user.cookie)).status,200);
 const state=(await f.call('/api/state','GET',undefined,user.cookie)).data;assert.deepEqual(state.competition.personal.forecasts.semifinales.selection,pick);assert.equal(state.competition.personal.points,0);assert.equal(state.competition.personal.position,1);
 assert.equal((await f.call('/api/competition/forecast','PUT',{phase:'semifinales',selection:{...pick,Coro:['demo-brujula']}},user.cookie)).status,400);
 assert.equal((await f.call('/api/competition/forecast','PUT',{phase:'ganador',selection:pick},user.cookie)).status,400);
 assert.equal((await f.call('/api/admin/results','PUT',{phase:'semifinales',category:'Comparsa',source:'https://official.example.test/results',reason:'Publicación verificada de prueba',confirmed:true,results:[{groupId:'demo-brujula',position:null}]},owner.cookie)).status,200);
 assert.equal((await f.call('/api/competition/forecast','PUT',{phase:'semifinales',selection:selection()},user.cookie)).status,423);
 await publishConfig(f,owner.cookie,c=>{c.forecasts.final.closesAt='2020-01-01T00:00:00.000Z';});assert.equal((await f.call('/api/competition/forecast','PUT',{phase:'final',selection:pick},user.cookie)).status,423);f.DB.sqlite.close();
});
test('official results calculate points and corrections recalculate all classifications with an audit trail',async()=>{
 const f=setup();const owner=await admin(f),user=await f.register();await publishConfig(f,owner.cookie,c=>{for(const p of ['semifinales','final','ganador'])c.forecasts[p].closesAt=future();});
 for(const phase of ['semifinales','final','ganador'])assert.equal((await f.call('/api/competition/forecast','PUT',{phase,selection:{...selection(),Comparsa:phase==='ganador'?['demo-brujula']:['demo-brujula','demo-papel']}},user.cookie)).status,200);
 const put=async(phase,results)=>{const r=await f.call('/api/admin/results','PUT',{phase,category:'Comparsa',source:'https://official.example.test/results',reason:'Publicación verificada de prueba',confirmed:true,results},owner.cookie);assert.equal(r.status,200,JSON.stringify(r.data));};
 await put('semifinales',[{groupId:'demo-brujula',position:null},{groupId:'demo-papel',position:null}]);await put('final',[{groupId:'demo-brujula',position:1},{groupId:'demo-papel',position:2}]);
 let league=(await f.call('/api/competition/league')).data;assert.equal(league.ranking[0].points,530);assert.equal(league.ranking[0].hits,5);assert.equal(league.ranking[0].exactHits,2);assert.equal(league.ranking[0].badges.length,4);
 assert.equal(JSON.stringify(league).includes('fan@example.test'),false);await put('final',[{groupId:'demo-brujula',position:2},{groupId:'demo-papel',position:1}]);league=(await f.call('/api/competition/league')).data;assert.equal(league.ranking[0].points,180);assert.equal(league.ranking[0].exactHits,0);
 assert.equal((await f.call('/api/competition/forecast','PUT',{phase:'ganador',selection:{...selection(),Comparsa:['demo-papel']}},user.cookie)).status,423);
 const audit=(await f.call('/api/admin/audit','GET',undefined,owner.cookie)).data.entries;assert.equal(audit.filter(e=>e.action==='results.publish').length,3);assert.ok(audit.find(e=>e.action==='results.publish'&&e.before?.length));assert.equal((await f.call('/api/admin/results','PUT',{},user.cookie)).status,403);f.DB.sqlite.close();
});
test('support has one changeable vote per modality and persistent aggregate trends, closing at contest start',async()=>{
 const f=setup(beforeContest());const user=await f.register();
 for(const id of ['demo-brujula','demo-papel','demo-papel'])assert.equal((await f.call('/api/competition/support','PUT',{groupId:id},user.cookie)).status,200);
 let result=(await f.call('/api/competition/support')).data;assert.equal(result.totals.Comparsa,1);assert.equal(result.participants,1);assert.equal(result.votes[0].groupId,'demo-papel');assert.equal(result.votes[0].percentage,100);assert.ok(result.history.length);assert.equal(JSON.stringify(result).includes('fan@example.test'),false);
 const owner=await admin(f);await publishConfig(f,owner.cookie,c=>{c.support.closesAt='2020-01-01T00:00:00.000Z';});assert.equal((await f.call('/api/competition/support','PUT',{groupId:'demo-brujula'},user.cookie)).status,423);f.DB.sqlite.close();
 const started=setup();const u=await started.register();assert.equal((await started.call('/api/competition/support','PUT',{groupId:'demo-brujula'},u.cookie)).status,423);started.DB.sqlite.close();
});
test('private leagues require high-entropy invitations, hide details from outsiders and keep forecasts on departure',async()=>{
 const f=setup();const a=await f.register(),b=await f.register('friend@example.test');const created=await f.call('/api/competition/leagues','POST',{name:'Los amigos del Falla'},a.cookie);assert.equal(created.status,201);assert.ok(created.data.inviteCode.startsWith('VC-'));const id=created.data.id;
 assert.equal((await f.call(`/api/competition/leagues/${id}`,'GET',undefined,b.cookie)).status,404);assert.equal((await f.call('/api/competition/leagues/join','POST',{code:'wrong-code'},b.cookie)).status,404);assert.equal((await f.call('/api/competition/leagues/join','POST',{code:created.data.inviteCode},b.cookie)).status,200);
 const detail=(await f.call(`/api/competition/leagues/${id}`,'GET',undefined,b.cookie)).data;assert.equal(detail.members.length,2);assert.equal(JSON.stringify(detail).includes('friend@example.test'),false);assert.equal((await f.call(`/api/competition/leagues/${id}/invite`,'POST',{},b.cookie)).status,403);
 const rotated=await f.call(`/api/competition/leagues/${id}/invite`,'POST',{},a.cookie);assert.equal(rotated.status,200);assert.notEqual(rotated.data.inviteCode,created.data.inviteCode);assert.equal((await f.call(`/api/competition/leagues/${id}`,'DELETE',undefined,b.cookie)).status,200);assert.equal((await f.call(`/api/competition/leagues/${id}`,'GET',undefined,b.cookie)).status,404);f.DB.sqlite.close();
});
test('bingo cards persist per function, detect lines and validate competitive marks without rewarding pre-marking',async()=>{
 const f=setup();const owner=await admin(f),a=await f.register(),b=await f.register('other@example.test');const draw=await f.call('/api/competition/bingo','POST',{sessionId:'demo-sesion-1'},a.cookie);assert.equal(draw.status,201);const card=draw.data.card;assert.equal(card.cells.length,25);assert.equal(new Set(card.cells.map(c=>c.id)).size,25);
 const same=await f.call('/api/competition/bingo','POST',{sessionId:'demo-sesion-1'},a.cookie);assert.equal(same.data.card.id,card.id);const other=await f.call('/api/competition/bingo','POST',{sessionId:'demo-sesion-1'},b.cookie);assert.notDeepEqual(other.data.card.cells,card.cells);
 const indices=[0,1,2,3,4];assert.equal((await f.call('/api/competition/bingo','PUT',{cardId:card.id,marked:indices},a.cookie)).data.card.verified.marked.length,0);
 for(const i of indices)assert.equal((await f.call('/api/admin/bingo-events','PUT',{sessionId:'demo-sesion-1',situationId:card.cells[i].id,occurred:true,reason:'Situación verificada de prueba'},owner.cookie)).status,200);
 let current=(await f.call('/api/competition/bingo?session=demo-sesion-1','GET',undefined,a.cookie)).data.card;assert.equal(current.verified.marked.length,0);
 await f.call('/api/competition/bingo','PUT',{cardId:card.id,marked:[]},a.cookie);const marked=await f.call('/api/competition/bingo','PUT',{cardId:card.id,marked:indices,points:99999},a.cookie);assert.equal(marked.data.card.verified.lines.length,1);
 const league=(await f.call('/api/competition/bingo/ranking?session=demo-sesion-1')).data;assert.equal(league.ranking[0].points,10);assert.equal((await f.call('/api/competition/bingo','PUT',{cardId:card.id,marked:[0]},b.cookie)).status,404);assert.equal((await f.call('/api/competition/bingo','PUT',{cardId:card.id,marked:[25]},a.cookie)).status,400);
 assert.equal(bingoLines(Array.from({length:25},(_,i)=>i)).lines.length,12);assert.equal(bingoLines(Array.from({length:25},(_,i)=>i)).bingo,true);assert.equal((await f.call('/api/competition/bingo/ranking?session=libre')).data.ranking.length,0);f.DB.sqlite.close();
});
test('traffic lights require a minimum sample and histories use real votes without filling missing phases',async()=>{
 assert.equal(trafficLight({advanced:{average:288,count:4}},'Comparsa',defaults.traffic).level,'insufficient');assert.equal(trafficLight({advanced:{average:224,count:5}},'Cuarteto',defaults.traffic).level,'excellent');assert.equal(trafficLight({apto:{average:65,count:5}},'Comparsa',defaults.traffic).level,'good');
 const f=setup();const full={presentation:10,pasodobles1:10,pasodobles2:10,cuples1:10,cuples2:10,estribillos1:10,estribillos2:10,popurri:10,tipo:8,impresionGeneral:4};
 for(let i=0;i<5;i++){const u=await f.register(`fan${i}@example.test`);assert.equal((await f.call('/api/votes','POST',{performanceId:'demo-p2',type:'advanced',score:0,details:full},u.cookie)).status,201);}
 const state=(await f.call('/api/state')).data;assert.equal(state.competition.traffic['demo-p2'].level,'excellent');assert.equal(state.competition.traffic['demo-p2'].count,5);
 const insight=(await f.call('/api/competition/insights?groups=demo-brujula,demo-papel')).data;assert.equal(insight.groups[0].average,288);assert.equal(insight.groups[0].count,5);assert.ok(insight.groups[0].history.length);assert.equal(insight.groups[0].phases.find(p=>p.phase==='final').average,null);assert.equal(insight.groups[0].phases.find(p=>p.phase==='final').status,'unknown');assert.equal(insight.headToHead.length,0);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) count FROM metric_snapshots').get().count,5);f.DB.sqlite.close();
});
test('moderation is server-side, audited and excludes suspicious contributions without deleting records',async()=>{
 const f=setup();const owner=await admin(f),u=await f.register();await f.call('/api/votes','POST',{performanceId:'demo-p2',type:'apto',score:1},u.cookie);
 const moderation=await f.call('/api/admin/moderation','PUT',{userId:u.data.user.id,status:'suspended',reason:'Actividad sospechosa de prueba'},owner.cookie);assert.equal(moderation.status,200);assert.equal((await f.call('/api/state')).data.counts.votes,0);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) count FROM votes').get().count,1);assert.equal((await f.call('/api/favorites','PUT',{groupId:'demo-brujula',favorite:true},u.cookie)).status,403);assert.equal((await f.call('/api/admin/moderation','PUT',{userId:owner.data.user.id,status:'suspended',reason:'Cannot suspend administrator'},owner.cookie)).status,400);
 assert.ok((await f.call('/api/admin/audit','GET',undefined,owner.cookie)).data.entries.some(e=>e.action==='account.moderate'));f.DB.sqlite.close();
});
test('integration has revocable server authentication, incremental replay and no personal or individual-vote exports',async()=>{
 const f=setup();const owner=await admin(f);assert.equal((await f.call('/api/integration/v1/snapshot')).status,401);const key=await f.call('/api/admin/integration-keys','POST',{label:'Fantasy integration test'},owner.cookie);assert.equal(key.status,201);const headers={Authorization:'Bearer '+key.data.token};
 const snapshot=await f.call('/api/integration/v1/snapshot','GET',undefined,undefined,headers);assert.equal(snapshot.status,200);assert.equal(snapshot.data.groups.length,8);assert.equal(JSON.stringify(snapshot.data).includes('admin@example.test'),false);assert.equal(JSON.stringify(snapshot.data).includes('password_hash'),false);assert.equal(snapshot.data.fantasy.roster.Comparsa,3);
 await publishConfig(f,owner.cookie,c=>{c.fantasy.prices['demo-brujula']=12.5;});const changes=await f.call('/api/integration/v1/changes?after='+snapshot.data.cursor,'GET',undefined,undefined,headers);assert.equal(changes.status,200);assert.ok(changes.data.events.some(e=>e.type==='rules.updated'));const replay=await f.call('/api/integration/v1/changes?after='+snapshot.data.cursor,'GET',undefined,undefined,headers);assert.deepEqual(replay.data.events,changes.data.events);
 assert.equal((await f.call('/api/integration/v1/changes?after=-1','GET',undefined,undefined,headers)).status,400);await f.call('/api/admin/integration-keys','DELETE',{id:key.data.id},owner.cookie);assert.equal((await f.call('/api/integration/v1/snapshot','GET',undefined,undefined,headers)).status,401);assert.equal(f.DB.sqlite.prepare('SELECT token_hash FROM integration_keys').get().token_hash.includes(key.data.token),false);f.DB.sqlite.close();
});
test('disabled modules and invalid configuration cannot be bypassed by direct requests',async()=>{
 const f=setup();const owner=await admin(f),u=await f.register();await publishConfig(f,owner.cookie,c=>{c.modules.bingo=false;c.modules.support=false;});assert.equal((await f.call('/api/competition/bingo','POST',{sessionId:'libre'},u.cookie)).status,423);assert.equal((await f.call('/api/competition/support','PUT',{groupId:'demo-brujula'},u.cookie)).status,423);
 const current=(await f.call('/api/admin/modules','GET',undefined,owner.cookie)).data;current.config.traffic.good=99;current.config.traffic.excellent=80;assert.equal((await f.call('/api/admin/modules','PUT',{config:current.config,expectedRevision:current.revision,reason:'Invalid threshold ordering test'},owner.cookie)).status,400);f.DB.sqlite.close();
});
test('a closure racing with a pending support write is checked atomically at database commit',async()=>{
 const f=setup(beforeContest());const owner=await admin(f),u=await f.register();await publishConfig(f,owner.cookie,c=>{c.support.closesAt=future();});
 const originalPrepare=f.DB.prepare.bind(f.DB);let release;let reached;const blocked=new Promise(resolve=>{reached=resolve;});const gate=new Promise(resolve=>{release=resolve;});
 f.DB.prepare=sql=>{const statement=originalPrepare(sql);if(sql.startsWith('INSERT INTO precontest_support')){const run=statement.run.bind(statement);statement.run=async()=>{reached();await gate;return run();};}return statement;};
 const pending=f.call('/api/competition/support','PUT',{groupId:'demo-brujula'},u.cookie);await blocked;await publishConfig(f,owner.cookie,c=>{c.support.open=false;});release();assert.equal((await pending).status,423);assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) count FROM precontest_support').get().count,0);f.DB.sqlite.close();
});
test('contest stage defaults to before, persists from administration and rejects unknown values',async()=>{
 const f=setup();const owner=await admin(f);const current=await f.call('/api/admin/modules','GET',undefined,owner.cookie);assert.equal(current.data.config.stage??'antes','antes');
 const saved=await publishConfig(f,owner.cookie,c=>{c.stage='durante';});assert.equal(saved.stage,'durante');
 const legacy=await publishConfig(f,owner.cookie,c=>{delete c.stage;});assert.equal(legacy.stage,'antes');
 const latest=await f.call('/api/admin/modules','GET',undefined,owner.cookie);const bad=await f.call('/api/admin/modules','PUT',{config:{...latest.data.config,stage:'despues'},expectedRevision:latest.data.revision,reason:'Etapa no válida de prueba'},owner.cookie);assert.equal(bad.status,400);f.DB.sqlite.close();
});
