# 강사 허브

K-뉴딜 아카데미 내부 운영진용 강사·시간표 허브. 지역·과정·과목·기관별 강사 목록과 시간표를 빠르게 파악한다.

- 구조: [출결앱](https://github.com/LamdaLee/attendance-check)과 같다 (Next.js 서버 + 집 Supabase 의 `hub` 스키마, `hub.api_*` 함수만 호출).
- 작업 지시서: [TASK.md](TASK.md)
- 기존 instructor-hub(Cloudflare Pages + Supabase 클라우드)의 백업 데이터를 가져와 쓴다. **백업 파일은 개인정보가 있으므로 이 저장소에 넣지 않는다.**
