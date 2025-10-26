const XLSX=require('xlsx');
const wb=XLSX.readFile('prepare/b.xlsx');
const ws=wb.Sheets[wb.SheetNames[0]];
const headerRow=3; // 1-based row index
const headers=[];
for(let col=0; col<200; col++){
  const addr=XLSX.utils.encode_cell({c:col,r:headerRow-1});
  const cell=ws[addr];
  if(!cell || !cell.v) continue;
  headers[col]=cell.v;
}
console.log('header sample:', headers.slice(0,30));
const targets=['入院日期','入住日期','入院时间','入住时间','收治日期','收治时间'];
const idx={};
targets.forEach(name=>{
  const index=headers.findIndex(h=>h===name);
  if(index>=0) idx[name]=index;
});
console.log('found columns:', idx);
for(let r=headerRow; r<headerRow+5; r++){
  const rowData={};
  Object.entries(idx).forEach(([name,col])=>{
    const addr=XLSX.utils.encode_cell({c:col,r});
    const cell=ws[addr];
    rowData[name]=cell?cell.v:'';
  });
  console.log(, rowData);
}
