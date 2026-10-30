import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pool} from '../server/db.js';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let requestId;const users=[];
await mkdir('test-results',{recursive:true});
try{
 await page.goto(base);await page.getByRole('heading',{name:'Know your land.'}).waitFor();await page.getByRole('button',{name:'URB-002',exact:true}).waitFor();
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});
 await page.getByRole('button',{name:'URB-002',exact:true}).click();await page.getByRole('heading',{name:'URB-002',exact:true}).waitFor();
 await page.getByRole('button',{name:'Request a service',exact:true}).click();await page.getByRole('button',{name:/Citizen demo/}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.locator('.toast').filter({hasText:"You're in citizen demo mode"}).waitFor();
 users.push((await (await context.request.get(base+'/api/auth/me')).json()).user.id);
 await page.getByRole('button',{name:'Request a service',exact:true}).click();await page.locator('select[name="service"]').selectOption('Ownership record enquiry');
 await page.getByLabel('Supporting details').fill('Browser integration verification: synthetic ownership enquiry.');
 await page.getByRole('button',{name:'Submit request',exact:true}).click();
 await page.getByRole('heading',{name:'Your requests, in view.'}).waitFor();
 const list=await(await context.request.get(base+'/api/applications')).json();requestId=list.applications[0].id;assert.equal(list.applications[0].status,'Submitted');
 await page.getByTitle('Sign out',{exact:true}).click();await page.getByRole('button',{name:'Try officer demo',exact:true}).waitFor();await page.getByRole('button',{name:'Try officer demo',exact:true}).click();await page.getByRole('heading',{name:'Service review queue.'}).waitFor();
 users.push((await(await context.request.get(base+'/api/auth/me')).json()).user.id);
 const card=page.locator('.application-card').filter({hasText:requestId});await card.getByRole('button',{name:'Review application'}).click();
 await page.getByLabel('Reason for decision').fill('Synthetic ownership enquiry reviewed successfully in browser verification.');await page.getByRole('button',{name:'Record decision',exact:true}).click();
 await card.getByText('Approved',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Governance insights',exact:true}).click();await page.getByRole('heading',{name:'A clearer view of governance.'}).waitFor();
 await page.screenshot({path:'test-results/insights.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('button',{name:'Parcel explorer',exact:true}).click();await page.getByRole('heading',{name:'Know your land.'}).waitFor();
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Mobile page should not overflow');
 assert.deepEqual(errors,[]);console.log('PASS: desktop and mobile UI, parcel selection, citizen submission, officer approval, insights and zero browser runtime errors.');
}catch(e){await page.screenshot({path:'test-results/failure.png',fullPage:true});throw e}finally{
 await browser.close();const c=await pool.connect();try{await c.query('BEGIN');if(requestId){await c.query('DELETE FROM bhoomi.audit WHERE application_id=$1',[requestId]);await c.query('DELETE FROM bhoomi.applications WHERE id=$1',[requestId])}if(users.length){await c.query('DELETE FROM bhoomi.sessions WHERE user_id=ANY($1::uuid[])',[users]);await c.query('DELETE FROM bhoomi.users WHERE id=ANY($1::uuid[])',[users])}await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await pool.end()}
}
