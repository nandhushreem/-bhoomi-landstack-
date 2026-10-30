export function sampleParcels(){
 const names=['Ananya Rao','Karthik Kumar','Meera Devi','Ravi Prakash','Lakshmi Nair','Arjun Reddy','Priya Menon','Suresh Babu','Divya Sharma','Vijay Anand','Kavya Iyer','Mohan Das'];
 return Array.from({length:60},(_,i)=>{
  const rural=i>=30, j=i%30, row=Math.floor(j/6), col=j%6;
  const x=(rural?77.718:77.593)+col*.0014+(row%2)*.00012, y=(rural?13.035:12.971)+row*.0011;
  const w=.00112,h=.00082;
  return {id:`${rural?'VIL':'URB'}-${String(j+1).padStart(3,'0')}`,survey_no:`${rural?'V':'W'}-${104+j}/A`,demo_identifier:`DEMO-${rural?'KA-V':'KA-U'}-${10001+j}`,owner:names[i%names.length],area:680+(i*137)%2400,zone:rural?(i%4===0?'Conservation':'Agricultural'):['Residential','Commercial','Residential','Mixed use','Public use'][i%5],locality:rural?'Sampige Village':'Ashok Nagar Ward',context:rural?'Rural':'Urban',tax_due:i%5===0?3200+i*37:0,disputed:i%13===0,encumbrance:i%9===0?'Sample mortgage recorded':'No sample encumbrance',permission:i%7===0?'Approval pending':'No active application',registered_at:'2025-11-12',version:1,source_updated:'2026-10-30',geometry:{type:'Polygon',coordinates:[[[x,y],[x+w,y+.00004],[x+w-.00006,y+h],[x+.00003,y+h-.00003],[x,y]]]}};
 });
}
export function recordChecks(p){
 const checks=[];
 if(p.disputed)checks.push({severity:'high',code:'DISPUTE',title:'Dispute requires review',detail:'A synthetic dispute flag is active. Changes require the officer review queue.'});
 if(Number(p.tax_due)>0)checks.push({severity:'medium',code:'TAX_DUE',title:'Outstanding sample tax',detail:`Fiscal dataset reports INR ${p.tax_due} outstanding. This is a review indicator, not a legal restriction.`});
 if(p.encumbrance.includes('mortgage'))checks.push({severity:'medium',code:'MORTGAGE',title:'Mortgage record present',detail:'Review the linked synthetic encumbrance record before a transaction.'});
 return checks;
}
