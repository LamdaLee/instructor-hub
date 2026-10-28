import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'강사 허브',description:'운영진 전용 강사·시간표 관리',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
