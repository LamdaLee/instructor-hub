# 승인된 포털 운영 반영

배포 대상: 기존 Lightsail의 instructor-hub 컨테이너. 도메인은 `https://timetable.alittlegarden.kr`이며 기존 출결앱·Caddy·DNS는 그대로 사용합니다. 클라우드 개발 환경 게시와 별개입니다.

## Lightsail 실행 순서

```bash
cd ~/instructor-hub
git status --short
# 변경 중인 코드가 있다면 먼저 별도로 보존합니다. .env는 그대로 둡니다.
git fetch origin codex/instructor-hub-portal
git switch --track origin/codex/instructor-hub-portal
bash scripts/deploy-portal.sh
```

이미 해당 브랜치에 있다면 `git pull --ff-only origin codex/instructor-hub-portal` 후 스크립트를 실행합니다. 스크립트는 Node.js 22 이상, Docker Compose v2, `.env`의 `DATABASE_URL`, `DATABASE_ADMIN_URL`, `SESSION_SECRET`, `APP_ORIGIN`, `CADDY_NETWORK=deploy_default` 설정을 사용합니다. 비밀값을 출력하지 않습니다. `DATABASE_ADMIN_URL`은 스크립트에만 쓰고 앱에 전달하지 않습니다.

1. npm 의존성 설치, `../hub-snapshots`에 chmod 600 gzip JSON 데이터 스냅샷을 만듭니다. `hub`와 `hub_meta`만 읽습니다. 연락처·계정 해시가 있으므로 외부 공유하지 마세요. 이 파일은 데이터 스냅샷이며 pg_dump를 대체하는 전체 DDL/역할 백업은 아닙니다.
2. 기존 앱 이미지를 `instructor-hub-rollback:before-portal`로 보존합니다.
3. 새 이미지를 먼저 빌드하고 0008 이후 새 마이그레이션을 적용합니다. 기존 데이터·원본 반 식별자·계정·수업·가져오기 기록은 유지합니다. 실패한 마이그레이션은 트랜잭션 롤백됩니다.
4. hub-app만 재시작하고 상태 점검합니다. 시작 실패 시 이전 이미지로 되돌립니다.
5. 실제 도메인에서 공개 화면·API·관리자 로그인 보호를 검사합니다.

`.env`가 분실되었거나 `DATABASE_ADMIN_URL`이 없다면 기존 관리 URL을 서버 파일에서 복구해야 합니다. 채팅에 비밀값을 붙이지 마세요.

## 적용되는 기능과 데이터

- 기본 기수는 활성 과정 중 최신 기수입니다. 전체/이전 기수는 필터로 조회할 수 있으며 이전 기수 데이터는 유지합니다.
- 공개 대시보드: LG전자 K-뉴딜 아카데미 타이틀, 지역/기수/트랙 필터, 오늘 수업·기관·강사·담당 매니저·강의장·교재 링크, 포스트잇 공지.
- 관리자 메뉴의 **강의장·매니저**에서 지역/기수별 현재 값을 확인하고 수정합니다. 기본 강의장과 날짜별 수업 장소는 별도로 보존하며, 해당 수업에 장소가 있으면 그날은 수업 장소를 표시합니다. 두 필드만 변경하는 관리자 전용 API와 변경 전후 기록을 사용합니다.
- 전체/지역 시간표: 지역·트랙 행 × 날짜·요일 열, 시작일/종료일·주/월 조회, 중립색 셀·기관색 배지, 셀 메모. 모바일은 날짜/트랙별 카드.
- 강사 이름을 누르면 현재 화면 위 중앙 모달에서 소속·메일·전화·메모를 공개합니다. 등록된 실제 연락처가 공개되는 것은 사용자가 선택한 정책입니다.
- 관리자 전용 `/admin`, 로그인 `/admin/login`. 과거 member 계정은 조회만 가능하고 일정·강사·과정·공지 수정은 거부됩니다. 공개 교재 수정·삭제는 모든 사용자에게 허용됩니다.
- 교재 업로드는 누구나 가능. 실제 PDF/PPTX 형식 검사, 파일당 50 MB, 현재 총 파일 메타데이터 기준 2 GiB 제한, 디스크 여유 200 MiB 검사, 15분당 출처 IP별 업로드 20회 제한. 기존 Caddy가 `X-Real-IP`를 설정하는지 확인하세요. 헤더가 없으면 공통 버킷으로 제한합니다.
- 파일명·과목·강사·등록자를 표시하고 다운로드는 attachment로 전달합니다. 공개 파일의 교체·정보 수정·삭제는 비로그인 누구나 가능하며 작업자 이름(자기 기입)과 사유를 기록합니다. 공개 여부 설정과 비공개 파일 접근은 관리자 전용. 삭제는 메타데이터와 파일을 보존하되 다운로드를 차단합니다. 교체 전 파일은 새 파일 확정 후 정리하고 변경 기록에는 전후 메타데이터를 보관합니다.
- 기존 수업의 배정 상태는 추정하지 않고 `임시`로 시작합니다. 관리자가 `변경예정`/`확정`을 지정하세요. 매니저·기본 강의장도 새 필드이므로 등록되지 않은 값은 `미등록`으로 표시합니다.
- 과목 이름 변경은 수업·모듈·자료·담당 과목 연결을 유지하며, 과목 삭제는 보관으로 처리합니다. 기존 과목명은 원문·변경 기록에 남습니다.

## 파일 보존과 복구

교재는 `instructor-hub_hub_materials` Docker 볼륨의 `/app/materials`에 저장됩니다. `docker compose down -v`나 볼륨 삭제를 실행하지 마세요. 정기 백업에는 이 볼륨과 DB의 hub 스키마를 함께 포함해야 합니다. 스크립트의 DB 데이터 스냅샷에는 파일 내용이 들어 있지 않습니다.

정상 시작 후 기능 문제로 이전 앱을 복원하려면 아래를 실행합니다. 추가된 DB 테이블/열과 데이터는 제거하지 않습니다.

```bash
cd ~/instructor-hub
cat > /tmp/hub-rollback.yml <<'YAML'
services:
  hub-app:
    image: instructor-hub-rollback:before-portal
YAML
docker compose --env-file .env -f deploy/docker-compose.yml -f /tmp/hub-rollback.yml -p instructor-hub up -d --no-build hub-app
rm /tmp/hub-rollback.yml
```

이전 UI로 돌아가도 DB의 공개 조회/관리자 쓰기 정책은 유지됩니다. DB를 되돌리려면 별도 복원 계획이 필요하며 전체 Supabase 덤프를 그대로 덮어쓰면 안 됩니다. 운영에서는 `db:test`, `test:http`, `test:e2e`를 실행하지 마세요. 가상 fixture는 로컬 테스트 전용입니다.
