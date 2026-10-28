import {createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
const allowed=new Set(['public.classes','public.instructors','public.timetables','public.profiles','auth.users','public.audit_logs']);
export function copyText(value) {
 if(value==='\\N') return null;
 return value.replace(/\\([0-7]{1,3}|x[0-9a-fA-F]{1,2}|[\s\S])/g,(_,v)=>{
  if(/^[0-7]/.test(v)) return String.fromCharCode(parseInt(v,8));
  if(v[0]==='x' && v.length>1) return String.fromCharCode(parseInt(v.slice(1),16));
  return ({b:'\b',f:'\f',n:'\n',r:'\r',t:'\t',v:'\v','\\':'\\'})[v] ?? v;
 });
}
export async function parseBackup(file) {
 const source=createReadStream(file);const unzip=createGunzip();source.on('error',e=>unzip.destroy(e));source.pipe(unzip);
 const lines=createInterface({input:unzip,crlfDelay:Infinity});const tables={};let table=null,columns=[];
 const digest=createHash('sha256');
 for await(const line of lines) {
  digest.update(line+'\n');
  const m=/^COPY\s+(?:"?([a-z_]+)"?)\.(?:"?([a-z_]+)"?)\s+\((.+)\) FROM stdin;$/.exec(line);
  if(m) {table=`${m[1]}.${m[2]}`;columns=m[3].split(/,\s*/).map(x=>x.replaceAll('"',''));if(allowed.has(table)) {if(tables[table]) throw new Error('중복 COPY 블록');tables[table]=[];}continue;}
  if(line==='\\.') {table=null;continue;}
  if(allowed.has(table)) {
   const values=line.split('\t');if(values.length!==columns.length)throw new Error('COPY 열 수 불일치');
   tables[table].push(Object.fromEntries(columns.map((c,i)=>[c,copyText(values[i])])));
  }
 }
 if(table) throw new Error('종료되지 않은 COPY 블록');
 for(const name of allowed)if(!tables[name])throw new Error('필수 COPY 블록 누락: '+name);
 return {tables,digest:digest.digest('hex')};
}
export function organization(value) {
 const key=(value??'').replace(/\s/g,'').toLowerCase();
 const map={assist:'aSSIST','어시스트':'aSSIST',clips:'CLIPS','클립스':'CLIPS',lge:'LGE',lg:'LGE','lg전자':'LGE',lab4dx:'LAB4DX','랩포디엑스':'LAB4DX'};
 if(map[key])return {organization:map[key],kind:'수업'};
 if(['공통','휴일'].includes(key))return {organization:null,kind:key};
 if(['','-','없음'].includes(key))return {organization:null,kind:'없음'};
 return {organization:null,kind:'수업',review_reason:'기관 확인 필요'};
}
export const nameKey=value=>(value??'').normalize('NFC').replace(/\s/g,'');
export function resolveInstructor(name,org,instructors) {
 if(!nameKey(name))return null;
 const all=instructors.filter(i=>nameKey(i.name)===nameKey(name));
 if(all.length===1)return all[0].id;
 const same=all.filter(i=>i.organization===org);return same.length===1?same[0].id:null;
}
export function transform(t) {
 const classes=t['public.classes'].map(c=>({id:c.id,region:c.region,cohort:Number(c.cohort),track:c.track,name:c.course_name||`${c.region} ${c.track} ${c.cohort}기`}));
 const instructors=t['public.instructors'].map(i=>({...i,...organization(i.organization)}));
 const review=[];
 const slots=t['public.timetables'].map(s=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.schedule_time??''))throw new Error('잘못된 시간표 날짜');
  if(!classes.some(c=>c.id===s.class_id))throw new Error('연결할 반이 없는 시간표');
  const org=organization(s.organization);const id=resolveInstructor(s.instructor_name,org.organization,instructors);
  const reason=[org.review_reason,(!id&&nameKey(s.instructor_name))?'강사 연결 확인 필요':null].filter(Boolean).join(', ')||null;
  if(reason)review.push({slot_id:s.id,instructor_name:s.instructor_name,organization:org.review_reason?s.organization:null,reason});
  return {id:s.id,class_id:s.class_id,day:s.schedule_time,subject:s.subject?.trim()||null,...org,instructor_id:id,instructor_name:s.instructor_name??'',place:s.location??'',review_reason:reason};
 });
 const operators=t['public.profiles'].filter(p=>p.is_approved==='t').map(p=>{
  const u=t['auth.users'].find(u=>u.id===p.id);if(!u?.encrypted_password || !/^\$2[aby]\$/.test(u.encrypted_password))throw new Error('승인 계정의 bcrypt 해시 누락');
  let meta={};try{meta=JSON.parse(u.raw_user_meta_data||'{}');}catch{}
  return {id:p.id,email:(p.email||u.email).trim().toLowerCase(),name:meta.name||meta.full_name||`${p.organization??''} 운영진`,password_hash:u.encrypted_password,role:p.role==='admin'?'admin':'member'};
 });
 if(!operators.some(o=>o.role==='admin'))throw new Error('활성 관리자 계정 누락');
 return {classes,instructors,slots,operators,review,audit:t['public.audit_logs']};
}
