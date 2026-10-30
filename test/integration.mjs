import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../server/db.js';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
const created=[],users=[];
function client(){let cookie='';return async(path,body,expected=200)=>{const r=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j}}
const a=client(),b=client(),off=client(),anon=client();
let baseline;
try{
 await anon('/health');
 await anon('/applications',undefined,401);
 const fixture=await anon('/parcels');assert.equal(fixture.parcels.length,60);baseline=fixture.parcels.find(p=>p.id==='URB-002');
 const email='test-'+randomUUID()+'@example.invalid',password='Test-'+randomUUID();
 const reg=await a('/auth/register',{name:'Integration Test Citizen',email,password},201);users.push(reg.user.id);assert.equal(reg.user.role,'citizen');
 await a('/auth/logout',{});await a('/auth/login',{email,password});
 users.push((await b('/auth/demo',{role:'citizen'})).user.id);
 users.push((await off('/auth/demo',{role:'officer'})).user.id);
 const make=async(parcel,extra={})=>{const j=await a('/applications',{parcel_id:parcel,service:'Area correction',requested_area:1200,details:'Integration verification synthetic request',...extra},201);created.push(j.application.id);return j.application};
 const first=await make('URB-002');assert.equal(first.status,'Submitted');
 assert.equal((await b('/applications')).applications.some(v=>v.id===first.id),false);
 await a('/applications/'+first.id+'/decision',{decision:'Approved',reason:'Synthetic verification approval'},403);
 await off('/applications/'+first.id+'/decision',{decision:'Approved',reason:'Synthetic verification approval'});
 const changed=(await anon('/parcels')).parcels.find(p=>p.id==='URB-002');assert.equal(changed.area,1200);assert.equal(changed.version,baseline.version+1);
 await off('/applications/'+first.id+'/decision',{decision:'Rejected',reason:'Duplicate decision must fail'},409);
 assert.equal((await a('/applications')).applications.find(v=>v.id===first.id).status,'Approved');
 assert.ok((await anon('/parcels/URB-002/history')).events.some(v=>v.action==='Approved'));
 const disputed=await make('URB-001',{service:'Ownership record enquiry'});assert.equal(disputed.status,'Under review');
 await off('/applications/'+disputed.id+'/decision',{decision:'Approved',reason:'Without acknowledgement fails'},409);
 await off('/applications/'+disputed.id+'/decision',{decision:'Rejected',reason:'Sample dispute requires further evidence'});
 const stale1=await make('URB-002',{requested_area:1300}),stale2=await make('URB-002',{requested_area:1400});
 await off('/applications/'+stale1.id+'/decision',{decision:'Approved',reason:'First concurrent application accepted'});
 await off('/applications/'+stale2.id+'/decision',{decision:'Approved',reason:'Stale concurrent application blocked'},409);
 await a('/applications',{parcel_id:'URB-002',service:'Area correction',requested_area:-1,details:'Invalid area should never be stored'},400);
 await a('/auth/logout',{});await a('/auth/login',{email,password});assert.ok((await a('/applications')).applications.some(v=>v.id===first.id));
 console.log('PASS: readiness, signup/login persistence, citizen isolation, role permissions, approval and audit, duplicate decisions, rejection, dispute review, stale versions and input validation.');
}finally{
 const c=await pool.connect();try{await c.query('BEGIN');if(created.length){await c.query('DELETE FROM bhoomi.audit WHERE application_id=ANY($1::text[])',[created]);await c.query('DELETE FROM bhoomi.applications WHERE id=ANY($1::text[])',[created])}if(baseline){const {checks,...original}=baseline;await c.query('UPDATE bhoomi.parcels SET data=$2 WHERE id=$1',[baseline.id,original])}if(users.length){await c.query('DELETE FROM bhoomi.sessions WHERE user_id=ANY($1::uuid[])',[users]);await c.query('DELETE FROM bhoomi.users WHERE id=ANY($1::uuid[])',[users])}await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await pool.end()}
}
