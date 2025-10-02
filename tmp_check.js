const tcb=require('@cloudbase/node-sdk');
require('dotenv').config();
(async()=>{
  const app=tcb.init({env:process.env.TCB_ENV,secretId:process.env.TENCENTCLOUD_SECRETID,secretKey:process.env.TENCENTCLOUD_SECRETKEY});
  const db=app.database();
  const patientsRes=await db.collection('patients').get();
  const problems=patientsRes.data.filter(p=>Number(p.latestAdmissionTimestamp)>=Date.parse('2025-09-01'));
  const keys=problems.map(p=>p.recordKey);
  if(!keys.length){console.log('no problems');return;}
  const recordsRes=await db.collection('excel_records').where({key:db.command.in(keys)}).get();
  const groups={};
  recordsRes.data.forEach(r=>{if(!groups[r.key]) groups[r.key]=[];groups[r.key].push(r);});
  keys.forEach(k=>{
    console.log('---',k,'---');
    const arr=(groups[k]||[]).sort((a,b)=>(Number(b.admissionTimestamp)||0)-(Number(a.admissionTimestamp)||0));
    arr.forEach(r=>{
      const ts=Number(r.admissionTimestamp)||0;
      console.log(new Date(ts).toISOString(),'rawRow',r.rawRowIndex,'timestamp',r.admissionTimestamp);
    });
  });
})();
