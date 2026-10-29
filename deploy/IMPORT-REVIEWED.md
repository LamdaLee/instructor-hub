# 2026-10-29 첨부 자료 대조와 운영 반영

사용자가 제공한 12개 파일을 비교했습니다. 개인정보가 들어 있는 원본·정리 JSON은 저장소에 포함하지 않습니다. 입력 파일은 사용자에게 별도 제공하는 `instructor-hub-reviewed-20261029.json.gz`입니다. 공개 교재 권한 변경은 사용자가 “로그인하지 않은 누구나 교재 수정 삭제가 가능해야 해”라고 명시적으로 확인한 정책입니다.

## 채택 기준

- 2기는 `K뉴딜2기_시간표_강사_통합본.xlsx`을 최우선 기준으로 합니다. 7개 반, 399개 일정(교육 371 / 휴일 21 / 공통 7), 강사 114명. 연락처·이메일은 모두 비어 있어 보조 자료로 대조했습니다.
- 기존 CSV의 1기는 8개 반·288건, 2026-09-14~2026-11-11입니다. 같은 CSV에 섞인 예전 2기 396건은 시간표 반영에서 제외합니다.
- instructors.csv와 instructors_rows.csv는 완전 동일(123행), schedules.csv와 timetables_rows.csv도 완전 동일(684행)합니다. 각각 한 번만 채택합니다.
- `[aSSIST] 강사 등록 양식`의 유효 명단 61명은 기존 이름·소속 자료상 LG 사내강사입니다. 파일명만으로 aSSIST 소속을 부여하지 않았습니다.
- 호칭 `(사외)`, ` 코치`와 공백만 이름 비교에서 제거합니다. 유사한 이름을 추정으로 합치지 않습니다. 소속이 다르면 별도 강사로 취급합니다.
- 통합본과 11월 간편 업로드 파일의 배정 차이 5건, 1026 원본의 실질적 배정 차이 3건은 최신 통합본을 기준으로 비교했습니다. 코치 호칭만 다른 14건은 실질적 변경으로 세지 않습니다.

## 보류와 자료 부족

- 노태우(aSSIST) 이메일, 송주한(LGE) 전화번호가 원본별로 달라 해당 필드는 보충하지 않습니다. 기존 값도 덮어쓰지 않습니다.
- 백주은/백재은, 이경훈/이경재는 통합본 자체의 확인 필요 표시를 보존하고 별도 인물로 유지합니다.
- 2기 강사 114명 중 97명은 첨부 자료에서 전화 또는 이메일을 확보했습니다. 나머지 17명은 자료 부족이며 LAB4DX 12명이 포함됩니다.
- CSV 1기 LAB4DX 수업 44건은 강사명 자체가 비어 있습니다. 이름 없이 배정하지 않습니다.
- 기존 로컬 기준 DB에는 1기 288건과 2기 399건이 이미 있었습니다. 대전 AX 1기의 10월 6·7·8·12·13·14일 6개 수업은 CSV와 달라 기존 DB를 보존합니다. 이 날짜들은 실제 운영 DB에서 다시 비교됩니다.
- 0819 LG 자료에는 8월 18일 일정도 있으나 CSV는 9월 14일부터 시작합니다. 1기 전체 범위와 8월 누락 여부는 별도 확인이 필요하며 일정 누락을 추정해서 채우지 않았습니다.
- 교구·교보재 체크리스트의 준비사항은 날짜·반 연결이 확실하지 않으면 수업 메모로 넣지 않습니다. 첨부 파일에는 실제 PDF/PPTX 교재가 없고 CSV의 문서 경로도 모두 비어 있어 교재 파일을 생성하지 않습니다.

상세 내용은 별도 제공한 `InstructorHub_자료검토_20261029.xlsx`에서 볼 수 있습니다. 보고서에는 실제 연락처 값을 넣지 않았습니다.

## 운영 서버 적용

먼저 제공한 `.json.gz`를 Mac의 다운로드 폴더에서 Lightsail로 보냅니다. 기존 키의 이름이 아래와 같을 때의 예시입니다.

```bash
scp -i ~/Downloads/LightsailDefaultKey-ap-southeast-2.pem \
  ~/Downloads/instructor-hub-reviewed-20261029.json.gz \
  ubuntu@13.55.71.2:/home/ubuntu/hub-import/
```

Lightsail 터미널:

```bash
cd ~/instructor-hub
git pull --ff-only origin codex/instructor-hub-portal
bash scripts/deploy-portal.sh
chmod 600 ~/hub-import/instructor-hub-reviewed-20261029.json.gz
npm run import-reconciled -- ~/hub-import/instructor-hub-reviewed-20261029.json.gz \
  --apply --report-file ~/hub-import/reviewed-import-result.json
```

배포 스크립트가 먼저 데이터 스냅샷을 만들고 공개 교재 수정·삭제용 0010 마이그레이션과 앱을 반영합니다. 이후 가져오기는 DB에 이미 있는 1·2기를 중복 생성하지 않고 빈 연락처와 명확한 강사 연결만 보충합니다. 운영에서 변경한 수업 내용·연락처·장소·메모·배정 상태는 유지하고 상충 항목은 보고서로 남깁니다. 빈 DB에서는 묶음에 있는 1·2기 반과 일정을 추가합니다.

`--apply`를 빼면 반영 없는 검증만 합니다. 결과 보고서의 `applied`는 실제 COMMIT 이후에만 true로 기록됩니다. 파일 전체의 SHA-256을 가져오기 기록에 남겨 같은 묶음을 재실행해도 중복 반영하지 않습니다. 일괄 SQL로 저장하며 오류 시 전체 트랜잭션을 롤백합니다. 변경 전후는 `hub.audit_logs`에 남습니다. 다른 Supabase 스키마나 계정은 수정하지 않습니다.

로컬 기준 검증에서는 신규 강사 12명, 기존 강사 61행 보완(담당 과목 포함), 빈 전화/이메일 각 12행 보충, 1기 강사 연결 46건이 나왔고 새 시간표는 0건이었습니다. 실제 운영 DB의 상태가 다르면 수치는 달라집니다. 이 결과를 운영 반영 완료로 해석하면 안 됩니다.

## 개발 검증

```bash
npm test
npm run db:test
node --env-file=.env scripts/test-reconciled-import.mjs
npm run typecheck
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

실제 DB 가져오기 테스트는 localhost DB에서 가상 반·강사·수업만 생성한 뒤 정리합니다. 운영 DB에서 테스트 명령을 실행하지 마세요.
