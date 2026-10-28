import 'server-only';
import {createHmac,randomBytes} from 'node:crypto';
export const COOKIE='hub_session';
export function hashToken(raw:string):Buffer{
 const secret=process.env.SESSION_SECRET;if(!secret||secret.length<32)throw new Error('SESSION_SECRET은 32자 이상이어야 합니다.');
 return createHmac('sha256',secret).update(raw).digest();
}
export const newToken=()=>randomBytes(32).toString('hex');
