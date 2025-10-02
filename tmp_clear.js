const tcb=require('@cloudbase/node-sdk');
require('dotenv').config();
const app=tcb.init({
  env:process.env.TCB_ENV,
  secretId:process.env.TENCENTCLOUD_SECRETID,
  secretKey:process.env.TENCENTCLOUD_SECRETKEY,
});
const db=app.database();
const collections=['excel_records','patients','patient_intake_records','excel_cache'];
(async()=>{
  try {
    for (const name of collections) {
      const coll=db.collection(name);
      let totalRemoved=0;
      for (;;) {
        const res=await coll.limit(100).get();
        const docs=res.data||[];
        if (!docs.length) break;
        await Promise.all(docs.map(doc=>coll.doc(doc._id).remove().catch(()=>null)));
        totalRemoved+=docs.length;
      }
      console.log(`CLEARED ${name}: ${totalRemoved}`);
    }
  } catch (err) {
    console.error('clear error', err);
  }
})();
