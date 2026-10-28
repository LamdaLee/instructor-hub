export function isDate(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;
}
export const isUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validFilter(f) {
 if(!f||typeof f!=='object'||Array.isArray(f))return false;
 const allowed=new Set(['region','cohort','track','organization','class_id','instructor_id','subject','from','to','id','q','archived','contacts','offset']);
 for(const [k,v] of Object.entries(f)) {
  if(!allowed.has(k)||typeof v!=='string'||v.length>300)return false;
  if(v&&['from','to'].includes(k)&&!isDate(v))return false;
  if(v&&['id','class_id','instructor_id'].includes(k)&&!isUuid(v))return false;
  if(v&&k==='cohort'&&!/^[1-9]\d{0,3}$/.test(v))return false;
  if(v&&k==='offset'&&!/^\d{1,6}$/.test(v))return false;
  if(v&&['archived','contacts'].includes(k)&&!['true','false'].includes(v))return false;
 }
 return !(f.from&&f.to&&f.from>f.to);
}
// 엑셀의 따옴표·탭·여러 줄 셀을 읽는다.
export function parseTsv(text) {
 const rows=[];let row=[],cell='',quote=false;
 for(let i=0;i<text.length;i++) {
  const c=text[i];
  if(c==='"'&&(quote||cell==='')){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}
  else if(!quote&&(c==='\t'||c==='\n'||c==='\r')) {
   row.push(cell);cell='';if(c!=='\t'){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(x=>x.trim()))rows.push(row);row=[];}
  } else cell+=c;
 }
 if(quote)throw new Error('따옴표가 닫히지 않은 셀이 있습니다.');
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 if(rows[0]?.[0].trim()==='날짜')rows.shift();
 if(!rows.length||rows.length>500)throw new Error('1~500행을 입력하세요.');
 return rows.map((r,i)=>{if(r.length<4||r.length>6||!isDate(r[0].trim()))throw new Error(`${i+1}행: 날짜(YYYY-MM-DD)와 4~6개 열을 확인하세요.`);return {day:r[0].trim(),subject:r[1].trim(),instructor_name:r[2].trim(),organization:r[3].trim(),place:r[4]?.trim()??'',note:r[5]?.trim()??''};});
}
export function csvCell(value){const s=String(value??'');const safe=/^[\s]*[=+@-]/.test(s)?"'"+s:s;return '"'+safe.replaceAll('"','""')+'"';}
export function validSave(kind,data) {
 if(!data||typeof data!=='object'||Array.isArray(data))return false;
 if(data.id&&!isUuid(data.id))return false;
 if(kind==='slots')return Array.isArray(data.rows)&&data.rows.length>0&&data.rows.length<=500&&data.rows.every(r=>r&&typeof r==='object'&&isUuid(r.class_id)&&isDate(r.day)&&(!r.id||isUuid(r.id))&&(!r.instructor_id||isUuid(r.instructor_id))&&['period','subject','instructor_name','organization','place','note'].every(k=>r[k]==null||typeof r[k]==='string'&&r[k].length<=2000)&&(!r.kind||['수업','공통','휴일','없음'].includes(r.kind)));
 if(!['instructor','class','operator','organization','subject'].includes(kind)||typeof data.name!=='string'||!data.name.trim()||data.name.length>200)return false;
 if(kind==='instructor')return (!data.archived_at||!Number.isNaN(Date.parse(data.archived_at)))&&Array.isArray(data.subjects)&&data.subjects.every(s=>typeof s==='string'&&s.length<=200)&&['phone','email','memo','organization'].every(k=>data[k]==null||typeof data[k]==='string'&&data[k].length<=10000);
 if(kind==='class')return typeof data.region==='string'&&typeof data.track==='string'&&Number.isInteger(data.cohort)&&data.cohort>0&&data.cohort<10000&&(!data.starts_on||isDate(data.starts_on))&&(!data.ends_on||isDate(data.ends_on))&&!(data.starts_on&&data.ends_on&&data.starts_on>data.ends_on);
 if(kind==='operator')return typeof data.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)&&data.email.length<=320&&['admin','member'].includes(data.role)&&typeof data.active==='boolean'&&(!data.password||typeof data.password==='string'&&new TextEncoder().encode(data.password).length<=72);
 return true;
}
