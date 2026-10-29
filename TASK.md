> 2026-10-29 추가 변경(최우선): 로그인하지 않으면 어떤 정보도 볼 수 없다. 기관 계정 가입은 LAB4DX가 승인하고, 강사 변경 신청은 LGE·LAB4DX가 승인·반려하며, aSSIST·CLIPS는 자기 기관 강사만 본다. 아래 공개 포털 문구는 이 변경으로 대체된다.
>
> 2026-10-29 사용자 승인으로 정책 변경: 아래의 초기 “내부 운영진 전용” 및 옛 화면 설명보다 최신 공개 포털 정책을 우선한다. 공개 조회와 모든 등록 강사의 연락처 공개, 비로그인 교재 업로드를 허용한다. 공개 교재 업로드·수정·삭제는 비로그인 누구나 가능하다(명시적 사용자 확인). 일정·강사·과정·공지는 `/admin`의 관리자만 변경한다. 새 화면과 배포 절차는 `deploy/PORTAL.md`를 따른다. 데이터 초기화나 백업 재가져오기는 하지 않는다.

# 강사 허브 재구축 작업 지시서 (출결앱 방식)

Codex 에게 주는 작업 지시서다. 기존 instructor-hub(Cloudflare Pages + Supabase 클라우드, 무료 플랜 정지됨)를 **출결앱(`LamdaLee/attendance-check`)과 같은 구조**로 새로 만든다. 단계별로 진행하고, 단계마다 테스트를 통과시킨 뒤 커밋한다.

## 목표

- **내부 운영진 전용** 서비스. 외부 기관(aSSIST·CLIPS·LGE·LAB4DX) 담당자 화면·승인 절차·기관별 권한 분리는 만들지 않는다. 로그인한 운영진은 전부 볼 수 있다.
- 지역별 · 과정(트랙)별 · 과목별 · 기관별로 **강사 목록과 시간표를 빠르게 파악**하는 것이 핵심. 화면은 작고 촘촘하게, 표 중심으로.
- 기존 백업의 데이터를 그대로 옮긴다.

## 구조 (출결앱을 그대로 따른다)

출결앱 저장소를 먼저 읽고 같은 방식으로 만든다.

- Next.js App Router(standalone) + React + `pg`. Dockerfile·`deploy/docker-compose.yml`·Caddy 구성도 출결앱과 같은 형태.
- DB 는 집 Supabase(Postgres)의 **별도 스키마 `hub`**. `public`·`auth`·`attendance` 스키마는 건드리지 않는다.
- 앱은 `hub_app` 역할로 접속해 **`hub.api_*` SECURITY DEFINER 함수만 호출**한다. 테이블 직접 접근 권한은 주지 않는다(출결앱의 `attendance_app` / `api_*` 방식과 동일).
- 서버: Lightsail 의 기존 Caddy 에 새 사이트(예: `hub.alittlegarden.kr`)를 추가하고, 앱 컨테이너는 Tailscale 경로로 집 Supabase 에 접속한다. 출결앱과 같은 서버에 같이 띄울 수 있게 compose 서비스 이름·포트가 겹치지 않도록 한다.
- 마이그레이션은 `db/migrations/0001_*.sql` … 형식, DB 테스트는 `db/tests/*.sql`(출결앱과 같은 방식).
- 비밀값(DB 비밀번호, 세션 비밀값)은 `.env` 로만. 코드·커밋에 넣지 않는다.

## 기존 데이터 (백업: Supabase `db_cluster-*.backup.gz`, pg_dumpall 형식)

**백업 파일에는 강사 연락처 등 개인정보가 있으므로 저장소에 절대 커밋하지 않는다.** 가져오기 스크립트는 파일 경로를 인자로 받는다.

옮길 데이터 (public 스키마):

| 원본 테이블 | 건수 | 주요 열 | 비고 |
|---|---|---|---|
| `classes` | 15 | region(부산·대구·대전), cohort(1·2), track(AX, AX1, AX2, SF, DM), course_name | 반 |
| `instructors` | 136 | name, organization(aSSIST·CLIPS·LGE·LAB4DX), phone, email, hub_archived_at | 강사 |
| `timetables` | 684 | schedule_time(**날짜 문자열 YYYY-MM-DD**), subject, organization, class_id, class_name(예: "대전 AX"), cohort, instructor_name | 시간표. instructor_id 는 전부 비어 있고 **강사는 instructor_name 텍스트로만** 들어 있다 |
| `profiles` + `auth.users` | 7 | email, organization, role(user·admin), is_approved, encrypted_password(bcrypt) | 운영진 계정 |
| `audit_logs` | 1047 | action, target_table, summary, user_email, created_at | 변경 기록 |

- `ih_*`, `hub_instructor_*` 테이블은 비어 있거나 외부 기관 승인용이므로 옮기지 않는다. 저장된 파일(storage)은 0건.
- timetables.organization 에는 'LG', 'LG전자', '클립스', '어시스트', '랩포디엑스', '공통', '휴일', '-' 같은 표기 변형이 있다. 4개 기관 코드로 정규화하고, '공통'·'휴일'·'-' 는 별도 구분(공통 / 휴일 / 없음)으로 둔다.
- 시간표의 instructor_name 은 강사 목록과 **이름으로 연결**한다(공백 제거 후 일치). 같은 이름이 둘 이상이면 같은 기관인 쪽으로, 그래도 모호하면 연결하지 않고 "확인 필요" 목록에 올린다. 연결 안 된 이름은 텍스트로 보존한다.
- 계정: auth.users 의 bcrypt 해시를 그대로 옮겨 `crypt(입력, 해시)` 로 검증한다(pgcrypto). 기존 비밀번호로 로그인되게 한다. 승인된(is_approved) 계정만 옮긴다.

가져오기는 `scripts/import-backup` (Node 또는 psql 스크립트):
1. gz 를 풀어 필요한 테이블의 `COPY ... FROM stdin` 블록만 파싱한다(전체 덤프를 DB 에 부으면 안 된다: 집 Supabase 의 시스템 역할·스키마를 덮어쓴다).
2. 새 스키마 형태로 변환해 `hub` 스키마에 넣는다. 여러 번 실행해도 결과가 같게(멱등).
3. 끝나면 건수 요약과 "확인 필요" 목록(연결 못 한 강사 이름, 정규화 못 한 기관 값)을 출력한다. 개인정보(연락처)는 출력하지 않는다.

## 데이터 모델 (`hub` 스키마)

- `regions`(대전·대구·부산), `organizations`(aSSIST·CLIPS·LGE·LAB4DX, 운영진이 추가 가능)
- `classes`: region, cohort, track, name(예: "대전 AX 2기"), starts_on, ends_on, active
- `subjects`: name, track(선택). 시간표의 subject 에서 만들어 둔다.
- `instructors`: name, organization, phone, email, subjects(담당 과목, 시간표 기록에서 자동 집계 + 직접 지정), memo, archived_at
- `slots`(시간표): class_id, day, period(선택: 오전/오후/시간 텍스트), subject, instructor_id(NULL 허용), instructor_name(원문 보존), organization, kind(수업·공통·휴일), place, note
- `operators`: email, name, password_hash, role(admin·member), active
- `sessions`, `audit_logs`(누가, 언제, 무엇을, 전·후 값). 출결앱처럼 변경은 전부 기록.

## 화면 (운영진 로그인 후)

공통: 상단에 **지역 · 기수 · 트랙 · 기관 필터**(선택 상태가 주소에 남아 공유 가능). 표는 촘촘하게, 모바일에서는 가로 스크롤 대신 카드로 접힘.

1. **대시보드**: 오늘·이번 주 수업 현황(반별 과목·강사·기관), 이번 주 강사 투입 수(기관별), 다가오는 2주 동안 강사 미배정 슬롯, "확인 필요" 건수.
2. **시간표**
   - 반 하나를 고르면 **주간 표**(행: 날짜, 열: 과목·강사·기관·장소). 이전/다음 주 이동, 오늘로.
   - 여러 반 비교: 같은 날짜에 지역·트랙별로 나란히(예: 대전 AX vs 대전 DM).
   - 강사 이름을 누르면 그 강사의 일정으로.
   - 편집: 칸 직접 수정, **엑셀 붙여 넣기 일괄 등록**(열: 날짜, 과목, 강사, 기관, 장소, 메모 / 탭 구분, 미리보기 후 저장, 같은 반·날짜 덮어쓰기 확인).
   - 같은 강사가 같은 날 두 반에 배정되면 경고.
3. **강사**
   - 목록: 이름, 기관, 담당 과목, 담당 지역·반, 총 수업일수, 최근/다음 수업일. 지역·과목·기관 필터와 이름 검색. 기관별·과목별 묶어 보기.
   - 상세: 연락처, 메모, 담당 과목, **수업 일정 목록(달력 형태 + 목록)**, 반별 수업일수.
   - 추가·수정·보관(삭제 대신 archived_at).
4. **집계**: 지역 × 기관, 과목 × 기관, 강사별 수업일수 표. 기간 선택. CSV 다운로드.
5. **관리**: 운영진 계정(추가·비활성·비밀번호 초기화), 반·기관·과목 관리, 변경 기록 조회.

## 보안

- 운영진 로그인만 존재. 비밀번호 실패 횟수 제한(출결앱 `rate_hit` 방식).
- 연락처는 목록에서 기본 숨김, 상세에서만 표시. CSV 에는 선택했을 때만 포함.
- 세션 쿠키 HttpOnly·Secure·SameSite, 변경 요청은 Origin 확인(출결앱과 동일).

## 단계

1. 스키마·api 함수·DB 테스트 + 가져오기 스크립트(로컬 Postgres 에 백업을 넣어 건수 검증).
2. 로그인·시간표(조회·편집·붙여 넣기)·강사 목록/상세.
3. 대시보드·집계·CSV·관리 화면.
4. 배포 문서: Lightsail 에 출결앱과 함께 띄우는 compose·Caddyfile 예시, 집 Supabase 에 마이그레이션 적용·가져오기 실행 순서, `hub_app` 역할 비밀번호 설정 방법(README).

## 완료 기준

- 백업 가져오기 후 반 15 · 강사 136 · 시간표 684 · 운영진 계정(승인된 7) 건수 일치, 확인 필요 목록 출력.
- 기존 운영진 계정이 기존 비밀번호로 로그인된다.
- DB 테스트·타입 검사·빌드 통과. 개인정보·비밀값이 커밋에 없다.
