#!/usr/bin/env bash
# Lightsail의 instructor-hub 체크아웃에서 실행. 기존 Caddy/출결앱은 변경하지 않는다.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then echo '.env가 필요합니다.' >&2; exit 1; fi
if ! node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'; then echo 'Node.js 22 이상이 필요합니다.' >&2; exit 1; fi
docker compose version >/dev/null
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then echo '수정 중인 추적 파일이 있습니다. 보존한 뒤 다시 실행하세요.' >&2; exit 1; fi
node --env-file=.env -e 'for(const k of ["DATABASE_URL","DATABASE_ADMIN_URL","SESSION_SECRET","APP_ORIGIN"])if(!process.env[k])throw new Error(k+" 누락");if(new URL(process.env.APP_ORIGIN).protocol!=="https:")throw new Error("APP_ORIGIN은 HTTPS 주소여야 합니다.")'
compose=(docker compose --env-file .env -f deploy/docker-compose.yml -p instructor-hub)
"${compose[@]}" config --quiet
npm ci --no-audit --no-fund
node --env-file=.env scripts/snapshot.mjs ../hub-snapshots
previous=$(docker inspect instructor-hub-hub-app-1 --format '{{.Image}}' 2>/dev/null || true)
if [ -n "$previous" ]; then docker image tag "$previous" instructor-hub-rollback:before-portal; fi
# 빌드가 성공한 뒤에만 DB와 실행 컨테이너를 변경한다.
"${compose[@]}" build hub-app
npm run db:migrate
"${compose[@]}" up -d --no-build hub-app
healthy=false
for attempt in $(seq 1 30); do
 status=$(docker inspect instructor-hub-hub-app-1 --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>/dev/null || true)
 if [ "$status" = healthy ]; then healthy=true; break; fi
 sleep 2
done
if [ "$healthy" != true ]; then
 echo '새 앱 상태 점검 실패. 컨테이너 로그를 확인하세요.' >&2
 if [ -n "$previous" ]; then
  rollback_file=$(mktemp /tmp/hub-rollback.XXXXXX.yml)
  trap 'rm -f "$rollback_file"' EXIT
  printf 'services:\n  hub-app:\n    image: instructor-hub-rollback:before-portal\n' >"$rollback_file"
  "${compose[@]}" -f "$rollback_file" up -d --no-build hub-app
  echo '이전 앱 이미지로 되돌렸습니다. 추가된 DB 구조와 데이터 스냅샷은 보존했습니다.' >&2
 fi
 exit 1
fi
node --env-file=.env --input-type=module <<'JS'
const origin=new URL(process.env.APP_ORIGIN).origin;
for(const path of ['/api/health','/','/api/read?view=options','/api/read?view=materials']){
 const res=await fetch(origin+path,{signal:AbortSignal.timeout(15000),redirect:'manual'});
 if(res.status!==200)throw new Error(path+' 응답 '+res.status);
 if(path.startsWith('/api/')&&!(await res.json()).ok)throw new Error(path+' API 점검 실패');
 console.log('운영 점검 통과:',path);
}
const admin=await fetch(origin+'/admin',{signal:AbortSignal.timeout(15000),redirect:'manual'});
if(![303,307,308].includes(admin.status)||!admin.headers.get('location')?.includes('/admin/login'))throw new Error('관리자 로그인 보호를 확인하세요.');
console.log('운영 점검 통과: 관리자 로그인 보호');
JS
echo '배포 완료. /admin에서 기존 관리자 계정으로 로그인하세요.'
echo '데이터 스냅샷은 ../hub-snapshots, 교재는 Docker hub_materials 볼륨에 보관됩니다.'
