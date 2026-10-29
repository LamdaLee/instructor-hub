"use strict";
const icons = {
  home: '<path d="m3 9 9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-8h6v8"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  map: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
  book: '<path d="M12 5C7 1 2 4 2 4v16s5-3 10 1c5-4 10-1 10-1V4s-5-3-10 1Zm0 0v16"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  note: '<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9"/><path d="m9 15 1-5L19 1l4 4-9 9Z"/>',
  room: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 20v-7h8v7M8 8h1M15 8h1"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  file: '<path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z"/><path d="M14 2v7h7M7 14h10M7 18h7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  logout: '<path d="M9 3H3v18h6M14 8l5 4-5 4M8 12h11"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
};
const icon = (name) =>
  `<svg aria-hidden="true" viewBox="0 0 24 24">${icons[name] || icons.grid}</svg>`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const orgs = [
  { id: "lge", name: "LG전자", cls: "org-lge" },
  { id: "clips", name: "CLIPS", cls: "org-clips" },
  { id: "assist", name: "aSSIST", cls: "org-assist" },
  { id: "lab", name: "LAB4DX", cls: "org-lab" },
  { id: "free", name: "프리랜서", cls: "org-free" },
];
const tracks = {
  DM: { name: "Digital Marketing", ko: "디지털 마케팅", cls: "dm" },
  AX: { name: "AX Workflow", ko: "AX 워크플로", cls: "ax" },
  SF: { name: "Smart Factory", ko: "스마트 팩토리", cls: "sf" },
};
const classes = [
  {
    id: "dj-dm",
    region: "대전",
    track: "DM",
    cohort: 2,
    name: "대전 1반",
    manager: "담당자 A",
    room: "대전 301호",
  },
  {
    id: "dj-ax",
    region: "대전",
    track: "AX",
    cohort: 2,
    name: "대전 2반",
    manager: "담당자 B",
    room: "대전 302호",
  },
  {
    id: "dg-sf",
    region: "대구",
    track: "SF",
    cohort: 2,
    name: "대구 1반",
    manager: "담당자 C",
    room: "대구 201호",
  },
  {
    id: "dg-ax",
    region: "대구",
    track: "AX",
    cohort: 2,
    name: "대구 2반",
    manager: "담당자 D",
    room: "대구 202호",
  },
  {
    id: "bs-dm",
    region: "부산",
    track: "DM",
    cohort: 2,
    name: "부산 1반",
    manager: "담당자 E",
    room: "부산 401호",
  },
  {
    id: "bs-sf",
    region: "부산",
    track: "SF",
    cohort: 2,
    name: "부산 2반",
    manager: "담당자 F",
    room: "부산 402호",
  },
  {
    id: "bs-ax",
    region: "부산",
    track: "AX",
    cohort: 2,
    name: "부산 3반",
    manager: "담당자 G",
    room: "부산 403호",
  },
];
const people = [
  {
    id: "t1",
    name: "김예시",
    org: "lge",
    subjects: "커리어 설계 · 협업 커뮤니케이션",
    memo: "조별 워크숍 진행",
  },
  {
    id: "t2",
    name: "이예시",
    org: "lab",
    subjects: "생성형 AI · 업무 자동화",
    memo: "준비물: 노트북·실습 계정",
  },
  {
    id: "t3",
    name: "박예시",
    org: "assist",
    subjects: "문제 해결 · 데이터 기반 사고",
    memo: "사례 토론을 중심으로 수업을 진행합니다.",
  },
  {
    id: "t4",
    name: "정예시",
    org: "clips",
    subjects: "셀프 리더십 · 팀 커뮤니케이션",
    memo: "수업 전 사전 질문지 확인",
  },
  {
    id: "t5",
    name: "최예시",
    org: "lab",
    subjects: "스마트 제조 · 데이터 분석",
    memo: "실습 예제: 교재 자료실",
  },
  {
    id: "t6",
    name: "윤예시",
    org: "lge",
    subjects: "고객가치 · 현장 프로젝트",
    memo: "과정별 프로젝트 확인",
  },
  {
    id: "t7",
    name: "한예시",
    org: "free",
    subjects: "디지털 콘텐츠 · 마케팅 기획",
    memo: "준비물: 포트폴리오 사례",
  },
];
const curriculum = {
  DM: [
    ["고객을 이해하는 마케팅", "고객 경험과 가치 발견", "t1"],
    ["데이터로 읽는 소비자", "마케팅 데이터의 첫걸음", "t3"],
    ["디지털 콘텐츠 기획", "우리 브랜드의 이야기", "t7"],
    ["강점 기반 셀프 리더십", "나의 강점 알아보기", "t4"],
    ["마케팅 프로젝트", "문제 정의와 아이디어", "t3"],
  ],
  AX: [
    ["생성형 AI와 업무 혁신", "AI와 함께 일하는 방법", "t2"],
    ["업무 자동화 워크플로", "반복 업무를 줄이는 설계", "t2"],
    ["협업 커뮤니케이션", "함께 일하는 팀 만들기", "t4"],
    ["데이터 기반 문제 해결", "질문에서 인사이트까지", "t3"],
    ["AI 미니 프로젝트", "나만의 업무 도우미", "t2"],
  ],
  SF: [
    ["스마트 팩토리의 이해", "제조 현장의 변화", "t5"],
    ["고객가치와 현장 혁신", "현장에서 발견하는 기회", "t6"],
    ["제조 데이터 활용", "데이터로 보는 품질", "t5"],
    ["문제 해결 워크숍", "함께 만드는 개선안", "t3"],
    ["스마트 제조 프로젝트", "작은 개선의 시작", "t5"],
  ],
};
const reference = "2026-11-02",
  days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];
const announcements = [
  {
    id: "a1",
    title: "실습 계정 사전 점검",
    body: "수업 전 로그인·접속 권한 확인. 계정 문제는 담당 매니저에게 전달.",
    scope: "전체",
    priority: true,
    color: "yellow",
    date: "2026.11.02",
    author: "관리자 예시",
  },
  {
    id: "a2",
    title: "강의장 변경",
    body: "11/4 AX 수업: 302호 → 305호. 강사·수강생 안내 필요.",
    scope: "대전",
    priority: false,
    color: "blue",
    date: "2026.11.02",
    author: "관리자 예시",
  },
  {
    id: "a3",
    title: "교재 수정본 배포",
    body: "마케팅 프로젝트 PDF 수정본 등록. 기존 파일 대신 수정본 사용.",
    scope: "부산",
    priority: false,
    color: "rose",
    date: "2026.11.02",
    author: "관리자 예시",
  },
];
const state = {
  view: "dashboard",
  date: reference,
  dashboardRegion: "",
  region: "",
  cohort: "2",
  track: "",
  org: "",
  search: "",
  admin: false,
  adminTab: "overview",
  week: 0,
  rangeStart: "2026-11-02",
  rangeEnd: "2026-11-06",
  notes: {
    "dj-ax:2026-11-02": "노트북 · AI 실습 계정 준비",
    "dg-sf:2026-11-03": "현장 사진 2장 미리 준비",
    "bs-dm:2026-11-04": "조별 발표 자료 확인",
  },
  extraLessons: [],
  hiddenPeople: [],
  mobileView: "date",
};
const audit = [
  {
    action: "시간표 변경",
    detail: "대전 · AX Workflow / 강사 배정: 임시 → 확정",
    time: "오늘 09:18",
    who: "관리자 예시",
  },
  {
    action: "교재 등록",
    detail: "데이터로 읽는 소비자 / PDF 파일 추가",
    time: "오늘 09:05",
    who: "관리자 예시",
  },
  {
    action: "과정 추가",
    detail: "3기 · 부산 · Smart Factory 과정 생성",
    time: "어제 16:40",
    who: "관리자 예시",
  },
];
const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
function org(id) {
  return orgs.find((o) => o.id === id) || orgs[4];
}
function badge(id) {
  const o = org(id);
  return `<span class="badge ${o.cls}"><i class="dot"></i>${o.name}</span>`;
}
function assignment(status) {
  return `<span class="badge assignment ${status === "변경예정" ? "change" : status === "임시" ? "temp" : ""}">${status === "확정" ? icon("check") : ""}${status}</span>`;
}
function teacher(id) {
  const p = people.find((x) => x.id === id);
  return p
    ? `<button class="teacher-link" data-teacher="${p.id}">${esc(p.name)}${icon("arrow")}</button>`
    : "<span>강사 미정</span>";
}
function selectedClasses() {
  return classes.filter(
    (c) =>
      (!state.region || c.region === state.region) &&
      (!state.cohort || String(c.cohort) === state.cohort) &&
      (!state.track || c.track === state.track),
  );
}
function lesson(c, day) {
  const extra = state.extraLessons.find(
    (x) => x.classId === c.id && x.day === day,
  );
  if (extra) return { ...extra, c };
  const index = days.indexOf(day);
  if (index < 0 || c.cohort !== 2) return null;
  const [subject, module, p] = curriculum[c.track][index];
  let person = people.find((x) => x.id === p);
  if (c.id === "bs-ax" && index === 0) person = people[3];
  const status =
    c.id === "bs-ax" && index === 0
      ? "변경예정"
      : c.id === "bs-sf" && index === 0
        ? "임시"
        : "확정";
  return {
    c,
    day,
    subject,
    module,
    teacherId: person.id,
    org: person.org,
    status,
    hours: 8,
  };
}
function matches(l) {
  return (
    l &&
    (!state.org || l.org === state.org) &&
    (!state.search ||
      `${l.subject}${people.find((p) => p.id === l.teacherId)?.name ?? ""}`.includes(
        state.search,
      ))
  );
}
function noteFor(l) {
  return state.notes[`${l.c.id}:${l.day}`] || "";
}
function noteMarkup(l) {
  const note = noteFor(l);
  return note
    ? `<button class="cell-note" data-note="${l.c.id}:${l.day}">${icon("note")}${esc(note)}</button>`
    : state.admin
      ? `<button class="small-link" data-note="${l.c.id}:${l.day}">${icon("plus")} 메모 추가</button>`
      : "";
}
function addAudit(action, detail) {
  audit.unshift({ action, detail, time: "방금", who: state.admin ? "관리자 예시" : "공개 등록자" });
}
function navigate(view) {
  state.view = view;
  state.search = "";
  if (view === "dashboard") {
    state.region = "";
    state.track = "";
    state.org = "";
  }
  if (view === "region" && !state.region) state.region = "대전";
  if (view !== "admin") state.adminTab = "overview";
  syncUrl();
  render();
  window.scrollTo(0, 0);
}
function syncUrl() {
  const params = new URLSearchParams({ view: state.view });
  for (const k of ["region", "cohort", "track", "org"])
    if (state[k]) params.set(k, state[k]);
  try {
    history.replaceState(null, "", "#" + params);
  } catch {}
}
function navButton(view, label, i) {
  return `<button class="nav-link ${state.view === view ? "active" : ""}" data-view="${view}">${icon(i)}${label}</button>`;
}
function shell() {
  const navigation = [
    ["dashboard", "수업 현황", "home"],
    ["schedule", "전체 시간표", "calendar"],
    ["region", "지역별 시간표", "map"],
    ["teachers", "강사 정보", "users"],
    ["materials", "교재 자료실", "book"],
  ];
  return `<div class="workspace"><header class="topbar app-header"><a class="brand app-brand" href="#" data-view="dashboard"><div class="brand-mark">LG</div><div class="brand-copy"><strong>LG전자 K-뉴딜 아카데미</strong><span>과정 운영</span></div></a><nav class="primary-nav" data-primary-nav aria-label="공개 메뉴">${navigation.map(([v, l, i]) => navButton(v, l, i)).join("")}</nav><div class="top-actions"><span class="mock-label">가상 데이터 목업</span>${state.admin ? `<button class="admin-access ${state.view === "admin" ? "active" : ""}" data-view="admin">${icon("shield")}<span>관리자</span></button><button class="icon-button" data-logout aria-label="공개 화면으로 돌아가기">${icon("logout")}</button>` : `<button class="admin-access" data-admin-entry data-admin-login aria-label="관리자 로그인">${icon("shield")}<span>관리자</span></button>`}</div></header><main class="main" id="main">${page()}</main></div><nav class="bottom-nav" aria-label="모바일 메뉴">${[
    ["dashboard", "수업", "home"],
    ["schedule", "시간표", "calendar"],
    ["region", "지역별", "map"],
    ["teachers", "강사", "users"],
    ["materials", "자료실", "book"],
  ]
    .map(
      ([v, l, i]) =>
        `<button class="${state.view === v ? "active" : ""}" data-view="${v}">${icon(i)}${l}</button>`,
    )
    .join("")}</nav>`;
}
function page() {
  return (
    (
      {
        dashboard: dashboard,
        schedule: schedule,
        region: regionPage,
        teachers: teachersPage,
        materials: materialsPage,
        admin: adminPage,
      }[state.view] || dashboard
    )() +
    `<p class="demo-foot">LG전자 K-뉴딜 아카데미 · 화면 검토용 목업 / 모든 인물·연락처·일정은 예시입니다.</p>`
  );
}
function head(
  title,
  sub,
  extra = "",
  eyebrow = "LG ELECTRONICS · K-NEW DEAL ACADEMY",
) {
  return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${sub ? `<p class="intro">${sub}</p>` : ""}</div>${extra}</div>`;
}
function datePicker() {
  return `<label class="date-pill">${icon("calendar")}<input type="date" aria-label="수업 조회 날짜" data-date value="${state.date}"><small>예시 기준일</small></label>`;
}
function announcementTile(n,manage=false){return `<article class="notice-card notice-${n.color} mosaic-item" data-notice-id="${n.id}"><div class="notice-top"><span class="notice-scope">${esc(n.scope)}</span>${n.priority?'<span class="notice-priority">중요</span>':''}<span class="notice-type">공지사항</span></div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notice-bottom"><small>${n.date} · ${n.author}</small>${manage?`<span><button data-edit-announcement="${n.id}" class="notice-action">수정</button><button data-delete-announcement="${n.id}" class="notice-action">삭제</button></span>`:''}</div></article>`;}
function announcementBoard(manage=false){return `<section class="announcements" aria-label="공지사항"><div class="section-head"><h2>공지사항</h2>${manage?`<button class="primary" data-add-announcement>${icon('plus')}공지 등록</button>`:'<span class="notice-access">공유사항 · 주의사항</span>'}</div><div class="notice-grid">${announcements.map(n=>announcementTile(n,manage)).join('')}</div>${!announcements.length?'<p class="empty">등록된 공지사항 없음</p>':''}</section>`;}
function courseArt(c){const id='art-'+c.id;const common=`<defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#dbeffb"/></linearGradient></defs>`;let graphic='';if(c.track==='DM'){graphic=`<circle cx="279" cy="69" r="48" fill="#ffdeb7"/><circle cx="83" cy="123" r="64" fill="#efcce3"/><rect x="65" y="39" width="226" height="140" rx="18" fill="url(#${id})" stroke="#bed3df"/><rect x="81" y="54" width="195" height="18" rx="7" fill="#e5edf4"/><circle cx="92" cy="63" r="3" fill="#f3ad9c"/><circle cx="102" cy="63" r="3" fill="#e5cb74"/><circle cx="112" cy="63" r="3" fill="#86c7b5"/><rect x="89" y="131" width="26" height="29" rx="5" fill="#a2c6fa"/><rect x="126" y="111" width="26" height="49" rx="5" fill="#9acfc3"/><rect x="163" y="93" width="26" height="67" rx="5" fill="#998bd3"/><rect x="200" y="110" width="26" height="50" rx="5" fill="#f2b596"/><path d="m96 115 43-30 42 6 56-41" fill="none" stroke="#3f8fa7" stroke-width="5" stroke-linecap="round"/><rect x="245" y="98" width="69" height="53" rx="13" fill="#fff" stroke="#d3dfdf"/><path d="M266 126h28m-14-11v22" stroke="#56aa9f" stroke-width="5" stroke-linecap="round"/>`;}else if(c.track==='AX'){graphic=`<circle cx="92" cy="99" r="67" fill="#6cdcd0" opacity=".6"/><circle cx="284" cy="112" r="58" fill="#a3e5f8" opacity=".6"/><rect x="90" y="47" width="181" height="121" rx="13" fill="url(#${id})" stroke="#c3e6e6"/><rect x="104" y="61" width="153" height="89" rx="6" fill="#123f4a"/><path d="M105 168h151l23 14H82z" fill="#daeef1"/><rect x="139" y="80" width="70" height="21" rx="8" fill="#00bcaa"/><path d="M174 101v16m0 0h-40m40 0h40" fill="none" stroke="#85d4dd" stroke-width="2"/><rect x="117" y="122" width="39" height="15" rx="5" fill="#d2ebff"/><rect x="194" y="122" width="39" height="15" rx="5" fill="#e4d9fc"/><rect x="40" y="64" width="58" height="58" rx="17" fill="#fff"/><path d="m61 86-8 7 8 7m15-14 8 7-8 7" fill="none" stroke="#00a99b" stroke-width="3" stroke-linecap="round"/><rect x="265" y="32" width="56" height="54" rx="15" fill="#eefbfc"/><path d="m293 43 4 11 11 4-11 4-4 12-4-12-12-4 12-4z" fill="#4d9cdb"/>`;}else{graphic=`<circle cx="83" cy="89" r="59" fill="#64c5fc" opacity=".48"/><circle cx="272" cy="104" r="67" fill="#8be4ec" opacity=".42"/><path d="m74 170 98-53 112 50-101 39z" fill="#69b7ec" opacity=".6"/><path d="M101 161V97l43 16V79l49 24V92l55 28v49l-69 25z" fill="url(#${id})" stroke="#d2e8f4"/><path d="m101 97 35-18 45 20-37 14z" fill="#d3edfa"/><path d="m144 79 35-18 49 23-35 19z" fill="#e4f5fd"/><path d="m193 92 35-15 55 25-35 18z" fill="#b7def4"/><rect x="205" y="121" width="15" height="18" rx="3" fill="#70b2db"/><rect x="226" y="130" width="14" height="18" rx="3" fill="#70b2db"/><rect x="157" y="113" width="14" height="18" rx="3" fill="#70b2db"/><path d="M121 67V38m0 0h17v36" stroke="#f0faff" stroke-width="13" stroke-linecap="round"/><circle cx="281" cy="58" r="24" fill="#fff"/><path d="M281 45v26m-13-13h26m-22-9 18 18m0-18-18 18" stroke="#328dc9" stroke-width="5"/>`;}
return `<svg class="course-art" viewBox="0 0 360 220" aria-hidden="true">${common}${graphic}</svg>`;}
function portalCourse(c,compact=false){const l=lesson(c,state.date),t=tracks[c.track];const tones={'dj-dm':'cream','dj-ax':'teal','dg-sf':'blue','dg-ax':'sky','bs-dm':'lilac','bs-sf':'ink','bs-ax':'mint'};return `<article class="course-card track-card tone-${tones[c.id]||'mint'} ${compact?'is-compact':''}">${compact?'':`<div class="course-artboard"><span class="art-caption">${c.track} TRACK</span>${courseArt(c)}</div>`}<div class="course-content"><div class="course-location"><button data-region="${c.region}">${c.region} · ${c.name}</button><span>${c.cohort}기</span></div><h2>${t.name}</h2><div class="course-lecture">${l?`<small>${state.date.slice(5).replace('-','.')} ${weekday(state.date)} · 09:00–18:00</small><h3>${esc(l.subject)}</h3><p>${esc(l.module)}</p>`:'<h3>등록된 수업 없음</h3>'}</div>${l?`<div class="course-person"><div class="inline">${teacher(l.teacherId)}${badge(l.org)}</div>${assignment(l.status)}</div>`:''}<div class="course-info"><span>매니저 <b>${c.manager}</b></span><span>강의장 <b>${c.room}</b></span></div><div class="course-actions"><button data-material-subject="${esc(l?.subject||'')}">${icon('book')}교재 확인 ${icon('arrow')}</button><button data-class="${c.id}">${icon('calendar')}반 시간표 ${icon('arrow')}</button></div>${l&&noteFor(l)?`<button class="course-prep" data-note="${c.id}:${state.date}">${icon('note')}${esc(noteFor(l))}</button>`:''}</div></article>`;}
function resourceTile(){return `<article class="resource-tile mosaic-item"><span class="resource-kicker">교재 자료실</span><h2>PDF · PPTX</h2><div class="resource-files"><span>${icon('file')}교과목별 교재</span><span>${icon('users')}강사별 자료</span></div><button data-view="materials">자료실 열기 ${icon('arrow')}</button></article>`;}
function dashboard(){const visible=classes.filter(c=>c.cohort===2&&(!state.dashboardRegion||c.region===state.dashboardRegion));const mobile=matchMedia('(max-width:700px)').matches;const card=(id,compact=false)=>{const c=visible.find(c=>c.id===id);return c?portalCourse(c,compact):'';};const notice=(i)=>announcements[i]?announcementTile(announcements[i],state.admin):'';const columns=state.dashboardRegion?[visible.map((c,i)=>portalCourse(c,i>0)).join(''),announcements.filter(n=>n.scope==='전체'||n.scope===state.dashboardRegion).map(n=>announcementTile(n,state.admin)).join(''),resourceTile()]:[card('dj-dm')+notice(0)+card('bs-dm',true)+card('bs-ax',true),card('dj-ax')+notice(2)+card('dg-ax')+resourceTile(),card('dg-sf')+notice(1)+card('bs-sf')];return `<section class="portal-intro"><span class="portal-kicker">과정 운영 · 2기</span><h1>LG전자 K-뉴딜<br><span>아카데미</span></h1><div class="portal-date">${datePicker()}</div><div class="portal-shortcuts"><button data-view="schedule">전체 시간표 ${icon('arrow')}</button><button data-view="region">지역별 시간표 ${icon('arrow')}</button></div></section><section class="portal-content" aria-label="수업 카드와 공지사항"><div class="portal-toolbar"><h2>수업 현황</h2><div class="dashboard-region-tabs" role="group" aria-label="수업 지역 선택">${[['','전체 지역'],['대전','대전'],['대구','대구'],['부산','부산']].map(([v,l])=>`<button aria-pressed="${(state.dashboardRegion||'')===v}" data-dashboard-region="${v}">${l}</button>`).join('')}</div></div>${mobile?`<div class="portal-mobile-notices">${announcementBoard(state.admin)}</div><div class="mosaic-grid is-mobile">${visible.map((c,i)=>portalCourse(c,i>1)).join('')}${resourceTile()}</div>`:`<div class="mosaic-grid">${columns.map((html,i)=>`<div class="mosaic-column column-${i+1}">${html}</div>`).join('')}</div>`}</section><section class="portal-region-section"><h2>지역별 시간표</h2><div class="portal-region-links">${['대전','대구','부산'].map(r=>`<button data-region="${r}">${icon('map')}<strong>${r}</strong>${icon('arrow')}</button>`).join('')}</div></section>`;}
function trackCard(c) {
  const t = tracks[c.track],
    l = lesson(c, state.date);
  return `<article class="track-card"><div class="track-header"><div><span class="track-token ${t.cls}">${c.track} TRACK</span><h3 class="track-title">${t.name}</h3><p class="track-class">${c.name} · ${c.cohort}기</p></div>${l ? assignment(l.status) : '<span class="badge assignment temp">수업 없음</span>'}</div><div class="track-meta"><span>${icon("person")}${c.manager}</span><span>${icon("room")}${c.room}</span></div>${l ? `<div class="lesson-box"><div class="lesson-time">${icon("clock")}09:00 – 18:00 <span>· ${l.hours}시간</span></div><p class="lesson-title">${l.subject}</p><p class="module-name">${l.module}</p><div class="lesson-teacher">${teacher(l.teacherId)}${badge(l.org)}</div></div>` : `<div class="lesson-box"><p class="lesson-title">등록된 수업 없음</p><p class="module-name">${c.cohort === 2 ? "다음 예시 수업: 11월 2일" : "시간표 미등록"}</p></div>`}<div class="card-bottom"><button class="materials-link" data-material-subject="${esc(l?.subject || "")}">${icon("book")}교재 확인</button><button class="small-link" data-class="${c.id}">반 시간표 ${icon("arrow")}</button></div>${l && noteFor(l) ? `<div class="card-note">${icon("note")}<span>${esc(noteFor(l))}</span></div>` : ""}</article>`;
}
function filterBar({ regional = false } = {}) {
  return `<div class="filters">${!regional ? filterSelect("region", "지역", ["대전", "대구", "부산"], "전체 지역") : ""}${filterSelect("cohort", "기수", [...new Set(classes.map((c) => String(c.cohort)))].sort(), "전체 기수", (v) => `${v}기`)}${filterSelect("track", "트랙", Object.keys(tracks), "전체 트랙", (v) => tracks[v].name)}${filterSelect(
    "org",
    "기관",
    orgs.map((o) => o.id),
    "전체 기관",
    (v) => org(v).name,
  )}<label class="search">과목 · 강사 검색<input type="search" aria-label="과목 또는 강사 검색" data-search value="${esc(state.search)}" placeholder="과목이나 강사 이름"></label></div>`;
}
function filterSelect(key, label, values, all, display = (v) => v) {
  return `<label>${label}<select data-filter="${key}" aria-label="${label} 필터"><option value="">${all}</option>${values.map((v) => `<option value="${v}" ${state[key] === v ? "selected" : ""}>${display(v)}</option>`).join("")}</select></label>`;
}
function activeFilterLabel() {
  return [
    state.region || "전체 지역",
    state.cohort ? `${state.cohort}기` : "전체 기수",
    state.track ? tracks[state.track].name : "전체 트랙",
    state.org ? org(state.org).name : "전체 기관",
  ].join(" · ");
}
function schedule({ regional = false, admin = false } = {}) {
  const visible = selectedClasses();
  const dates = scheduleDates();
  const count = visible
    .flatMap((c) => dates.map((d) => lesson(c, d)))
    .filter(matches).length;
  return (
    (!regional && !admin
      ? head(
          "전체 시간표",
          "",
          `<button class="secondary" data-export>${icon("download")}예시 엑셀 내려받기</button>`,
        )
      : "") +
    filterBar({ regional }) + `<form class="schedule-range" id="schedule-range"><label>시작일<input type="date" name="start" aria-label="조회 시작일" value="${state.rangeStart}" required></label><span>–</span><label>종료일<input type="date" name="end" aria-label="조회 종료일" value="${state.rangeEnd}" required></label><button class="primary" type="submit">기간 적용</button><span class="range-presets"><button type="button" data-period="week">1주</button><button type="button" data-period="month">1개월</button></span><small role="status" id="range-error"></small></form>` +
    `<div class="filter-state"><span>${activeFilterLabel()} <b>· ${count}개 수업 표시</b> / 선택 기간</span><button data-reset>필터 초기화</button></div><div class="section-head"><div class="inline"><button class="icon-button" aria-label="이전 주" data-week="-1">${icon("left")}</button><h2>${dates[0].replaceAll("-", ".")} – ${dates.at(-1).replaceAll("-", ".")}</h2><button class="icon-button" aria-label="다음 주" data-week="1">${icon("arrow")}</button><button class="small-link" data-this-week>예시 주간</button></div><div class="legend">${orgs
      .slice(0, 4)
      .map((o) => badge(o.id))
      .join(
        "",
      )}</div></div>${admin ? `<div class="inline" style="margin-bottom:18px"><button class="primary" data-edit-session>${icon("plus")}수업 추가</button><button class="secondary" data-paste="schedule">${icon("grid")}엑셀 붙여 넣기</button></div>` : ""}${count ? scheduleGrid(visible, dates) + mobileSchedule(visible, dates) : `<div class="empty"><h3>조회 결과 없음</h3><p>적용 필터 확인 필요.<br>예시 일정: 2026.11.02–11.06</p><button class="secondary" data-reset>필터 초기화</button></div>`}<div class="split-note">${icon("note")}셀 메모: 해당 수업의 준비사항·주의사항. ${state.admin ? "관리자만 추가·수정 가능." : "일정·메모 수정은 관리자 전용."}</div>`
  );
}
function scheduleDates() {
  const dates=[];
  for(let d=state.rangeStart; d<=state.rangeEnd && dates.length<366; d=moveDay(d,1)) dates.push(d);
  return dates;
}
function scheduleGrid(cs, dates) {
  const groups=["대전","대구","부산"].map(r=>({r,cs:cs.filter(c=>c.region===r)})).filter(g=>g.cs.length);
  return `<div class="schedule-shell"><div class="schedule-scroll"><table class="schedule-table schedule-transposed"><caption class="sr-only">지역·트랙 행과 날짜·요일 열로 보는 시간표</caption><thead><tr><th scope="col">지역</th><th scope="col">트랙 · 반</th>${dates.map(d=>`<th scope="col" class="${['토','일'].includes(weekday(d))?'weekend':''}">${d.slice(5).replace('-','.')}<small>${weekday(d)}요일</small></th>`).join('')}</tr></thead><tbody>${groups.map(g=>g.cs.map((c,i)=>`<tr class="${i===0?'region-start':''}">${i===0?`<th class="region-row" scope="rowgroup" rowspan="${g.cs.length}">${g.r}</th>`:''}<th scope="row" class="track-row">${tracks[c.track].name}<small>${c.name} · ${c.cohort}기</small></th>${dates.map(day=>{const l=lesson(c,day);return `<td>${matches(l)?`<div class="cell-title">${esc(l.subject)}</div><div class="cell-meta">${teacher(l.teacherId)}</div><div class="cell-meta">${badge(l.org)}${assignment(l.status)}</div><small>${esc(l.module)}</small>${noteMarkup(l)}${state.admin?`<button class="small-link" data-edit-session="${c.id}:${day}">수업 수정</button>`:''}`:'<small class="no-lesson">—</small>'}</td>`}).join('')}</tr>`).join('')).join('')}</tbody></table></div></div>`;
}
function mobileSchedule(cs, dates) {
  return `<div class="schedule-mobile"><div class="tabs" aria-label="모바일 시간표 보기"><button data-mobile-mode="date" class="${state.mobileView === "date" ? "active" : ""}">날짜별 보기</button><button data-mobile-mode="track" class="${state.mobileView === "track" ? "active" : ""}">트랙별 보기</button></div>${
    state.mobileView === "date"
      ? dates
          .map(
            (d, i) =>
              `<details class="day-group" ${i === 0 ? "open" : ""}><summary>${Number(d.slice(5, 7))}월 ${Number(d.slice(-2))}일 ${weekday(d)}요일 <small>${cs.map((c) => lesson(c, d)).filter(matches).length}개 수업</small></summary>${cs
                .map((c) => lesson(c, d))
                .filter(matches)
                .map(mobileLesson)
                .join("")}</details>`,
          )
          .join("")
      : cs
          .map(
            (c, i) =>
              `<details class="day-group" ${i === 0 ? "open" : ""}><summary>${c.region} · ${tracks[c.track].name}</summary>${dates
                .map((d) => lesson(c, d))
                .filter(matches)
                .map(mobileLesson)
                .join("")}</details>`,
          )
          .join("")
  }</div>`;
}
function mobileLesson(l) {
  return `<article class="mobile-lesson" data-org="${l.org}"><div class="mobile-class"><span>${l.c.region} · ${tracks[l.c.track].name} · ${l.c.cohort}기</span><span>${l.day.slice(5).replace("-", ".")}</span></div><h3>${esc(l.subject)}</h3><p class="module-name">${esc(l.module)}</p><div class="lesson-teacher">${teacher(l.teacherId)}${badge(l.org)}${assignment(l.status)}</div>${noteMarkup(l)}${state.admin ? `<button class="small-link" data-edit-session="${l.c.id}:${l.day}">수업 수정</button>` : ""}</article>`;
}
function regionPage() {
  const region = state.region || "대전";
  state.region = region;
  return (
    head("지역별 시간표", "") +
    `<div class="region-switch">${["대전", "대구", "부산"].map((r) => `<button class="${region === r ? "active" : ""}" data-region="${r}">${r}</button>`).join("")}</div><div class="region-summary">${icon("map")}<div><h2>${region} 캠퍼스</h2><p>${classes
      .filter((c) => c.region === region && c.cohort === 2)
      .map((c) => tracks[c.track].name)
      .join(" · ")}</p></div></div>` +
    schedule({ regional: true })
  );
}
function teachersPage() {
  const count = people.filter(
    (p) =>
      !state.hiddenPeople.includes(p.id) &&
      (!state.org || p.org === state.org) &&
      (!state.search || (p.name + p.subjects).includes(state.search)),
  ).length;
  return (
    head("강사 정보", "") +
    `<div class="filters">${filterSelect(
      "org",
      "기관",
      orgs.map((o) => o.id),
      "전체 기관",
      (v) => org(v).name,
    )}<label class="search">강사 · 과목 검색<input type="search" data-search value="${esc(state.search)}" placeholder="이름이나 담당 과목"></label></div><div class="filter-state"><span>${count}명 표시 · ${state.org ? org(state.org).name : "전체 기관"}</span><button data-reset>필터 초기화</button></div>${people.filter(p=>!state.hiddenPeople.includes(p.id)&&(!state.org||p.org===state.org)&&(!state.search||(p.name+p.subjects).includes(state.search))).map(p=>`<article class="teacher-summary">${teacher(p.id)}${badge(p.org)}<span>${esc(p.subjects)}</span><button class="small-link" data-teacher="${p.id}">상세 정보</button></article>`).join("")}<p class="privacy-info">모든 연락처와 안내 메모가 공개되는 구성입니다. 목업의 연락처는 가상 정보입니다. 이전·다음 강사: 화살표 또는 J/K, 닫기: Esc.</p>`
  );
}
const materialData = [
  {
    subject: "데이터로 읽는 소비자",
    teacherId: "t3",
    format: "PDF",
    size: "4.2 MB",
    filename: "데이터로읽는소비자_박예시_강의자료_v2.pdf",
  },
  {
    subject: "생성형 AI와 업무 혁신",
    teacherId: "t2",
    format: "PPTX",
    size: "12.8 MB",
    filename: "생성형AI와업무혁신_이예시_실습교재.pptx",
  },
  {
    subject: "강점 기반 셀프 리더십",
    teacherId: "t4",
    format: "PDF",
    size: "2.6 MB",
    filename: "강점기반셀프리더십_정예시_워크북.pdf",
  },
  {
    subject: "데이터로 읽는 소비자",
    teacherId: "t7",
    format: "PPTX",
    size: "8.4 MB",
    filename: "데이터로읽는소비자_한예시_사례자료.pptx",
  },
  {
    subject: "스마트 팩토리의 이해",
    teacherId: "t5",
    format: "PDF",
    size: "5.1 MB",
    filename: "스마트팩토리의이해_최예시_기본교재.pdf",
  },
  {
    subject: "고객가치와 현장 혁신",
    teacherId: "t6",
    format: "PPTX",
    size: "9.3 MB",
    filename: "고객가치와현장혁신_윤예시_수업자료.pptx",
  },
];
function materialsPage() {
  const filtered = materialData.filter(
    (m) => (state.admin || m.public !== false) && (!state.search || m.subject.includes(state.search)),
  );
  return (
    head("교재 자료실", "", `<button class="primary" data-upload>교재 업로드</button>`) +
    `<div class="filters"><label>과목 검색<input type="search" data-search value="${esc(state.search)}" placeholder="교과목 이름으로 찾기"></label></div><div class="material-grid">${filtered.map((m) => `<article class="material-card"><div class="file-icon ${m.format === "PPTX" ? "pptx" : ""}">${m.format}</div><h3>${esc(m.subject)}</h3><div class="lesson-teacher">${teacher(m.teacherId)}</div><p class="file-name">${esc(m.filename)}</p><div class="material-meta"><span>${m.size}</span><span>수정 2026.10.29</span></div><button class="secondary" data-download="${esc(m.filename)}">${icon("download")}교재 내려받기</button>${state.admin ? `<div class="material-actions"><button class="secondary" data-edit-material="${materialData.indexOf(m)}">파일 수정</button><button class="secondary danger" data-delete-material="${materialData.indexOf(m)}">삭제</button></div>` : ""}</article>`).join("")}</div><p class="privacy-info">누구나 교재를 업로드할 수 있습니다. 파일 수정·삭제는 관리자 전용입니다. 예시 교재는 파일 정보만 있으며, 직접 올린 파일은 새로고침 전까지 내려받을 수 있습니다.</p>`
  );
}
function adminPage() {
  if (!state.admin)
    return head(
      "관리자 전용 공간",
      "자료의 등록·수정·삭제는 관리자 로그인 후 이용합니다.",
      `<button class="primary" data-admin-login>관리자 로그인</button>`,
    );
  const tabs = [
    ["overview", "운영 개요"],
    ["announcements", "공지사항"],
    ["classes", "과정 · 반"],
    ["schedule", "시간표"],
    ["catalog", "과목 · 강사"],
    ["materials", "자료실"],
    ["audit", "변경 기록"],
  ];
  return (
    head(
      "아카데미 운영 관리",
      "",
      `<button class="secondary" data-logout>${icon("logout")}공개 화면으로</button>`,
      "ADMIN · 운영자 전용",
    ) +
    `<div class="admin-banner">${icon("shield")}관리자 화면 목업입니다. 변경은 이 화면의 메모리에만 저장되고 운영 DB에는 반영되지 않습니다.</div><div class="tabs" style="display:flex;flex-wrap:wrap">${tabs.map(([v, l]) => `<button class="${state.adminTab === v ? "active" : ""}" data-admin-tab="${v}">${l}</button>`).join("")}</div>${(
      {
        overview: adminOverview,
        announcements: () => announcementBoard(true),
        classes: adminClasses,
        schedule: () => schedule({ admin: true }),
        catalog: adminCatalog,
        materials: adminMaterials,
        audit: adminAudit,
      }[state.adminTab] || adminOverview
    )()}`
  );
}
function adminOverview() {
  return (
    announcementBoard(true) +
    `<div class="admin-grid"><section class="panel"><h2>과정 · 기수 관리</h2><p class="intro">지역·기수·트랙·매니저·강의장 등록</p><button class="primary" style="margin-top:24px" data-add-class>${icon("plus")}3기 · 4기 과정 추가</button></section><section class="panel"><h2>엑셀 일괄 등록</h2><p class="intro">붙여 넣기 → 중복·연결 검증 → 반영</p><div class="inline" style="margin-top:24px"><button class="secondary" data-paste="schedule">시간표 붙여 넣기</button><button class="secondary" data-paste="teachers">강사 붙여 넣기</button></div></section><section class="panel wide lucian-status-panel"><h2>강사 배정 상태</h2><p class="intro" style="margin-bottom:20px">예정 수업의 강사 배정 상태</p>${window.lucian039Markup()}</section></div><div class="panel"><div class="section-head"><h2>최근 변경 기록</h2><button class="small-link" data-admin-tab="audit">모든 기록 보기 ${icon("arrow")}</button></div>${audit.slice(0, 3).map(auditItem).join("")}</div>`
  );
}
function adminClasses() {
  return `<section class="panel"><div class="section-head"><h2>지역별 과정 · 반</h2><button class="primary" data-add-class>${icon("plus")}과정 추가</button></div><table class="admin-table"><thead><tr><th>지역 / 기수</th><th>트랙 · 반</th><th>담당 매니저</th><th>강의장</th><th>관리</th></tr></thead><tbody>${classes.map((c) => `<tr><td data-label="지역 / 기수">${c.region} · ${c.cohort}기</td><td data-label="트랙">${tracks[c.track].name}<small> ${c.name}</small></td><td data-label="매니저">${esc(c.manager)}</td><td data-label="강의장">${esc(c.room)}</td><td data-label="관리"><button class="tiny" data-edit-class="${c.id}">수정</button><button class="tiny danger" data-delete-class="${c.id}">삭제</button></td></tr>`).join("")}</tbody></table></section>`;
}
function adminCatalog() {
  return `<section class="panel"><div class="section-head"><h2>교과목 · 모듈</h2><button class="secondary" data-add-subject>${icon("plus")}과목 추가</button></div><table class="admin-table"><thead><tr><th>트랙</th><th>교과목</th><th>모듈</th><th>관리</th></tr></thead><tbody>${Object.entries(
    curriculum,
  )
    .flatMap(([t, items]) =>
      items
        .slice(0, 2)
        .map(
          (row, i) =>
            `<tr><td data-label="트랙">${tracks[t].name}</td><td data-label="교과목">${row[0]}</td><td data-label="모듈">${row[1]}</td><td data-label="관리"><button class="tiny" data-subject="${t}:${i}">수정</button><button class="tiny danger" data-delete-subject="${t}:${i}">삭제</button></td></tr>`,
        ),
    )
    .join(
      "",
    )}</tbody></table></section><section class="panel"><div class="section-head"><h2>강사 관리</h2><div class="inline"><button class="secondary" data-paste="teachers">엑셀 붙여 넣기</button><button class="primary" data-add-teacher>${icon("plus")}강사 추가</button></div></div><table class="admin-table"><thead><tr><th>강사</th><th>소속</th><th>담당 과목</th><th>관리</th></tr></thead><tbody>${people
    .filter((p) => !state.hiddenPeople.includes(p.id))
    .map(
      (p) =>
        `<tr><td data-label="강사">${teacher(p.id)}</td><td data-label="소속">${badge(p.org)}</td><td data-label="담당 과목">${esc(p.subjects)}</td><td data-label="관리"><button class="tiny" data-edit-teacher="${p.id}">수정</button><button class="tiny danger" data-delete-teacher="${p.id}">삭제</button></td></tr>`,
    )
    .join("")}</tbody></table></section>`;
}
function adminMaterials() {
 return `<section class="panel"><div class="section-head"><h2>교재 자료 관리</h2><button class="primary" data-upload>교재 업로드</button></div><p class="privacy-info">과목·강사별 교재를 등록하고 파일을 교체하거나 삭제합니다. 모든 변경은 변경 기록에 남습니다.</p><div class="material-grid">${materialData.map((m,i)=>`<article class="material-card"><div class="file-icon">${m.format}</div><h3>${esc(m.subject)}</h3>${teacher(m.teacherId)}<p class="file-name">${esc(m.filename)}</p><p>${esc(m.size)} · ${m.public===false?'비공개':'공개'}</p><div class="material-actions"><button class="secondary" data-edit-material="${i}">파일 수정</button><button class="secondary danger" data-delete-material="${i}">삭제</button></div></article>`).join('')}</div></section>`;
}
function auditItem(a) {
  return `<div class="audit-item"><span class="audit-circle">${icon("note")}</span><div><p><strong>${esc(a.action)}</strong> · ${esc(a.detail)}</p><small>${a.time} · ${a.who} / 변경 전·후 값과 사유를 함께 보관</small></div></div>`;
}
function adminAudit() {
  return `<section class="panel"><h2>변경 기록</h2><p class="intro" style="margin-bottom:15px">추가·수정·삭제·일괄 등록·파일 변경을 빠짐없이 기록합니다.</p>${audit.map(auditItem).join("")}</section>`;
}
function weekday(d) {
  return ["일", "월", "화", "수", "목", "금", "토"][
    new Date(d + "T12:00:00Z").getUTCDay()
  ];
}
function moveDay(day, n) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function render() {
  app.innerHTML = shell();
  bind();
  document.querySelectorAll(".u039").forEach(window.mountLucian039);
  document.querySelectorAll(".u273").forEach(window.mountLucian273);
}
let returnFocus = null;
function openModal(title, body, { drawer = false } = {}) {
  returnFocus = document.activeElement;
  modalRoot.innerHTML = `<div class="modal-overlay"><section class="${drawer ? "drawer" : "dialog"}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-button" data-close aria-label="닫기">${icon("close")}</button></div>${body}</section></div>`;
  modalRoot.querySelector("[data-close]").onclick = closeModal;
  modalRoot.querySelector(".modal-overlay").onclick = (e) => {
    if (e.target.classList.contains("modal-overlay")) closeModal();
  };
  document.body.style.overflow = "hidden";
  app.inert = true;
  setTimeout(
    () => modalRoot.querySelector("input,textarea,select,button")?.focus(),
    0,
  );
}
function closeModal() {
  modalRoot.innerHTML = "";
  document.body.style.overflow = "";
  app.inert = false;
  returnFocus?.focus();
}
let teacherModalIndex=-1;
function showTeacher(id, moving=false) {
  const list=people.filter(p=>!state.hiddenPeople.includes(p.id));
  const p=list.find(p=>p.id===id); if(!p)return;
  teacherModalIndex=list.indexOf(p);
  const origin=moving?returnFocus:document.activeElement;
  openModal("강사 상세 정보",`<div class="teacher-modal"><div class="teacher-avatar">${esc(p.name.slice(0,1))}</div><h3>${esc(p.name)}</h3>${badge(p.org)}<dl><dt>소속</dt><dd>${esc(org(p.org).name)}</dd><dt>메일주소</dt><dd><a href="mailto:example@example.invalid">example@example.invalid</a></dd><dt>전화번호</dt><dd><a href="tel:01000000000">010-0000-0000</a></dd><dt>담당 과목</dt><dd>${esc(p.subjects)}</dd><dt>메모</dt><dd>${esc(p.memo||'등록된 메모 없음')}</dd></dl><div class="teacher-modal-nav"><button class="secondary" id="teacher-prev" ${teacherModalIndex===0?'disabled':''}>이전 강사</button><span class="teacher-index">${teacherModalIndex+1} / ${list.length}</span><button class="secondary" id="teacher-next" ${teacherModalIndex===list.length-1?'disabled':''}>다음 강사</button></div></div>`);
  returnFocus=origin;
  modalRoot.querySelector('[role="dialog"]').setAttribute('aria-hidden','false');
  document.getElementById('teacher-prev').onclick=()=>showTeacher(list[teacherModalIndex-1].id,true);
  document.getElementById('teacher-next').onclick=()=>showTeacher(list[teacherModalIndex+1].id,true);
}
function login() {
  openModal(
    "관리자 로그인",
    `<p class="intro" style="margin-bottom:22px">일정·자료 변경은 관리자 전용입니다.<br>공개 화면은 로그인 없이 이용할 수 있습니다.</p><div class="form-grid"><label class="wide">이메일<input type="email" placeholder="관리자 이메일" value="admin@example.invalid"></label><label class="wide">비밀번호<input type="password" placeholder="목업에서는 입력하지 않아도 됩니다" autocomplete="off"></label></div><p class="privacy-info">화면 확인용 목업입니다. 실제 계정이나 비밀번호를 입력하지 마세요.</p><div class="dialog-actions"><button class="primary" id="preview-admin">관리 화면 미리보기 ${icon("arrow")}</button></div>`,
  );
  document.getElementById("preview-admin").onclick = () => {
    state.admin = true;
    state.view = "admin";
    state.adminTab = "overview";
    state.region = "";
    state.track = "";
    state.org = "";
    closeModal();
    render();
    window.scrollTo(0, 0);
  };
}
function showNote(key) {
  const [id, day] = key.split(":");
  const c = classes.find((x) => x.id === id),
    l = lesson(c, day);
  if (!l) return;
  openModal(
    "수업 메모 · 준비사항",
    `<div class="lesson-detail"><small>${c.region} · ${tracks[c.track].name} / ${day}</small><h3>${esc(l.subject)}</h3><div class="lesson-teacher">${teacher(l.teacherId)}${badge(l.org)}</div></div>${state.admin ? `<label>공개 준비사항<textarea class="paste-input" id="note-edit">${esc(state.notes[key] || "")}</textarea></label><div class="dialog-actions"><button class="primary" id="save-note">메모 저장</button></div>` : `<p style="line-height:1.9">${esc(state.notes[key] || "등록된 준비사항이 없습니다.")}</p><p class="privacy-info">이 메모는 누구나 읽을 수 있고, 관리자만 작성·수정할 수 있습니다.</p>`}`,
  );
  if (state.admin)
    document.getElementById("save-note").onclick = () => {
      const text = document.getElementById("note-edit").value.trim();
      state.notes[key] = text;
      addAudit(
        "셀 메모 수정",
        `${c.region} · ${tracks[c.track].name} / ${day}`,
      );
      closeModal();
      render();
      toast("메모 저장 완료 · 변경 기록 반영");
    };
}
function announcementEditor(id) {
  if (!state.admin) return;
  const n = announcements.find((n) => n.id === id) || {
    title: "",
    body: "",
    scope: "전체",
    priority: false,
    color: "yellow",
  };
  openModal(
    id ? "공지 수정" : "공지 등록",
    `<form id="announcement-form"><div class="form-grid"><label class="wide">제목<input name="title" value="${esc(n.title)}" maxlength="80" required></label><label>대상 지역<select name="scope">${["전체", "대전", "대구", "부산"].map((r) => `<option ${n.scope === r ? "selected" : ""}>${r}</option>`).join("")}</select></label><label>색상<select name="color">${[
      ["yellow", "노랑"],
      ["blue", "파랑"],
      ["rose", "분홍"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${n.color === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="wide">내용<textarea aria-label="내용" name="body" maxlength="500" required>${esc(n.body)}</textarea></label><label class="notice-check"><input type="checkbox" name="priority" ${n.priority ? "checked" : ""}>중요 공지</label></div><div class="dialog-actions"><button class="primary" type="submit">공지 저장</button></div></form>`,
  );
  document.getElementById("announcement-form").onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const item = {
      ...data,
      title: String(data.title).trim(),
      body: String(data.body).trim(),
      priority: data.priority === "on",
      date: "2026.11.02",
      author: "관리자 예시",
    };
    if (!item.title || !item.body) return;
    if (id) Object.assign(n, item);
    else announcements.unshift({ id: "notice-" + Date.now(), ...item });
    addAudit(id ? "공지 수정" : "공지 등록", item.title);
    closeModal();
    render();
    toast("공지 저장 완료");
  };
}
function classEditor(id) {
  if (!state.admin) return;
  const c = classes.find((x) => x.id === id) || {
    region: "대전",
    cohort: 3,
    track: "AX",
    name: "",
    manager: "",
    room: "",
  };
  openModal(
    id ? "과정 · 반 수정" : "새 기수 · 과정 추가",
    `<form id="class-form"><div class="form-grid"><label>지역<select name="region">${["대전", "대구", "부산"].map((v) => `<option ${c.region === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>기수<input type="number" name="cohort" min="1" max="99" value="${c.cohort}" required><small>기수 제한 없음</small></label><label>트랙<select name="track">${Object.entries(
      tracks,
    )
      .map(
        ([k, t]) =>
          `<option value="${k}" ${c.track === k ? "selected" : ""}>${t.name}</option>`,
      )
      .join(
        "",
      )}</select></label><label>반 이름<input name="name" value="${esc(c.name)}" placeholder="예: 대전 1반" required></label><label>담당 매니저<input name="manager" value="${esc(c.manager)}" placeholder="담당자 이름" required></label><label>강의장<input name="room" value="${esc(c.room)}" placeholder="예: 대전 301호" required></label></div><div class="dialog-actions"><button class="primary" type="submit">${id ? "변경 저장" : "과정 추가"}</button></div></form>`,
  );
  document.getElementById("class-form").onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    data.cohort = Number(data.cohort);
    if (id) Object.assign(c, data);
    else classes.push({ id: "new-" + Date.now(), ...data });
    addAudit(
      id ? "과정 수정" : "과정 추가",
      `${data.cohort}기 · ${data.region} · ${tracks[data.track].name}`,
    );
    state.adminTab = "classes";
    closeModal();
    render();
    toast("과정 저장 완료");
  };
}
function pasteDialog(kind) {
  if (!state.admin) return;
  const isTeachers = kind === "teachers",
    sample = isTeachers
      ? "강사명\t소속\t이메일\t전화번호\t메모\n임예시\tLG전자\tsample@example.invalid\t010-0000-0000\t워크숍 안내"
      : "날짜\t반\t교과목\t강사명\t소속\t메모\n2026-11-03\t대전 2반\t업무 자동화 워크플로\t이예시\tLAB4DX\t노트북 준비";
  openModal(
    isTeachers ? "강사 엑셀 붙여 넣기" : "시간표 엑셀 붙여 넣기",
    `<p class="intro">엑셀에서 복사한 셀을 붙여 넣고, 미리보기에서 연결 결과를 확인하세요.</p><textarea class="paste-input" id="paste-text" aria-label="엑셀 데이터">${esc(sample)}</textarea><button class="secondary" id="paste-preview">미리보기</button><div id="paste-result"></div>`,
  );
  document.getElementById("paste-preview").onclick = () => {
    const rows = document
      .getElementById("paste-text")
      .value.trim()
      .split(/\r?\n/)
      .map((l) => l.split("\t"));
    const target = document.getElementById("paste-result");
    if (rows.length < 2) {
      target.innerHTML = '<p class="privacy-info">헤더와 데이터 행 필요</p>';
      return;
    }
    target.innerHTML = `<p class="privacy-info">${rows.length - 1}행을 읽었습니다. 실제 구현에서는 중복·날짜·기관·강사 연결을 검증한 뒤, 기존 데이터와의 차이를 표시합니다.</p><div style="overflow:auto;margin-top:15px"><table class="preview-table"><thead><tr>${rows[0].map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows
      .slice(1)
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join(
        "",
      )}</tbody></table></div><div class="dialog-actions"><button class="primary" id="paste-apply">목업에 반영</button></div>`;
    document.getElementById("paste-apply").onclick = () => {
      if (isTeachers) {
        for (const row of rows.slice(1)) {
          if (!row[0]) continue;
          const o = orgs.find((x) => x.name === row[1]) || orgs[4];
          people.push({
            id: "p-" + Date.now() + "-" + people.length,
            name: row[0],
            org: o.id,
            subjects: "담당 과목 연결 예정",
            memo: row[4] || "",
          });
        }
      } else {
        for (const row of rows.slice(1)) {
          const c = classes.find((c) => c.name === row[1]);
          const p = people.find((p) => p.name === row[3]);
          if (c && p && /^\d{4}-\d{2}-\d{2}$/.test(row[0])) {
            state.extraLessons = state.extraLessons.filter(
              (x) => !(x.classId === c.id && x.day === row[0]),
            );
            state.extraLessons.push({
              classId: c.id,
              day: row[0],
              subject: row[2],
              module: "엑셀 등록 예시",
              teacherId: p.id,
              org: p.org,
              status: "임시",
              hours: 8,
            });
            state.notes[`${c.id}:${row[0]}`] = row[5] || "";
          }
        }
      }
      addAudit(
        "엑셀 일괄 등록",
        `${isTeachers ? "강사" : "시간표"} ${rows.length - 1}행 · 목업에서만 반영`,
      );
      closeModal();
      render();
      toast("목업 반영 완료 · 운영 DB 변경 없음");
    };
  };
}
function sessionEditor(key) {
  if (!state.admin) return;
  let c = classes[0],
    day = reference;
  if (key) {
    const parts = key.split(":");
    c = classes.find((x) => x.id === parts[0]) || c;
    day = parts[1] || day;
  }
  const l = lesson(c, day) || {
    subject: "",
    module: "",
    teacherId: "t1",
    status: "임시",
  };
  openModal(
    key ? "수업 수정" : "수업 추가",
    `<form id="session-form"><div class="form-grid"><label>반<select name="classId">${classes.map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${x.region} · ${x.cohort}기 · ${tracks[x.track].name}</option>`).join("")}</select></label><label>날짜<input type="date" name="day" value="${day}" required></label><label class="wide">교과목<input name="subject" value="${esc(l.subject)}" required></label><label class="wide">모듈<input name="module" value="${esc(l.module)}"></label><label>강사<select name="teacherId">${people.map((p) => `<option value="${p.id}" ${p.id === l.teacherId ? "selected" : ""}>${p.name} · ${org(p.org).name}</option>`).join("")}</select></label><label>강사 배정 상태<select name="status">${["임시", "변경예정", "확정"].map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}</select></label><label class="wide">공개 준비사항<textarea name="note">${esc(state.notes[`${c.id}:${day}`] || "")}</textarea></label></div><div class="dialog-actions"><button class="primary" type="submit">변경 저장</button></div></form>`,
  );
  document.getElementById("session-form").onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const p = people.find((x) => x.id === d.teacherId);
    state.extraLessons = state.extraLessons.filter(
      (x) => !(x.classId === d.classId && x.day === d.day),
    );
    state.extraLessons.push({ ...d, org: p.org, hours: 8 });
    state.notes[`${d.classId}:${d.day}`] = d.note;
    addAudit(
      "시간표 수정",
      `${classes.find((x) => x.id === d.classId).name} / ${d.day} / ${d.status}`,
    );
    closeModal();
    render();
    toast("시간표 저장 완료 · 변경 기록 반영");
  };
}
function teacherEditor(id) {
  if (!state.admin) return;
  const p = people.find((x) => x.id === id) || {
    name: "",
    org: "lge",
    subjects: "",
    memo: "",
  };
  openModal(
    id ? "강사 정보 수정" : "강사 추가",
    `<form id="teacher-form"><div class="form-grid"><label>이름<input name="name" value="${esc(p.name)}" required></label><label>소속<select name="org">${orgs.map((o) => `<option value="${o.id}" ${o.id === p.org ? "selected" : ""}>${o.name}</option>`).join("")}</select></label><label>메일주소<input name="email" type="email" placeholder="sample@example.invalid"></label><label>전화번호<input name="phone" placeholder="010-0000-0000"></label><label class="wide">담당 과목<input name="subjects" value="${esc(p.subjects)}"></label><label class="wide">공개 안내 메모<textarea name="memo">${esc(p.memo)}</textarea></label></div><p class="privacy-info">요청하신 정책에 따라 연락처와 안내 메모가 공개 강사 상세에 표시됩니다. 목업은 가상 연락처로만 표시합니다.</p><div class="dialog-actions"><button class="primary">저장</button></div></form>`,
  );
  document.getElementById("teacher-form").onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    if (id) Object.assign(p, d);
    else people.push({ id: "newteacher-" + Date.now(), ...d });
    addAudit(id ? "강사 수정" : "강사 추가", `${d.name} / ${org(d.org).name}`);
    closeModal();
    render();
    toast("강사 정보 저장 완료");
  };
}
function subjectEditor(key) {
  if (!state.admin) return;
  const [track, index] = key ? key.split(":") : ["AX", null],
    item = index !== null ? curriculum[track][Number(index)] : ["", "", "t2"];
  openModal(
    key ? "교과목 · 모듈 수정" : "교과목 추가",
    `<form id="subject-form"><div class="form-grid"><label>트랙<select name="track">${Object.entries(
      tracks,
    )
      .map(
        ([k, t]) =>
          `<option value="${k}" ${k === track ? "selected" : ""}>${t.name}</option>`,
      )
      .join(
        "",
      )}</select></label><label>교과목<input name="subject" value="${esc(item[0])}" required></label><label class="wide">모듈<input name="module" value="${esc(item[1])}" required></label></div><div class="dialog-actions"><button class="primary">저장</button></div></form>`,
  );
  document.getElementById("subject-form").onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    if (key) curriculum[track][Number(index)] = [d.subject, d.module, item[2]];
    else curriculum[d.track].push([d.subject, d.module, "t2"]);
    addAudit("과목 변경", `${d.subject} / ${tracks[d.track].name}`);
    closeModal();
    render();
    toast("과목 저장 완료");
  };
}
function confirmDelete(title, detail, fn) {
  if (!state.admin) return;
  openModal(
    title,
    `<p class="intro">${esc(detail)}</p><p class="privacy-info">실제 구현에서는 공개 목록에서 숨기고, 연결된 수업과 변경 전후 이력을 보존합니다. 목업에서는 화면의 예시 항목만 숨깁니다.</p><div class="dialog-actions"><button class="secondary" id="cancel-delete">취소</button><button class="primary danger-btn" id="confirm-delete">삭제 처리</button></div>`,
  );
  document.getElementById("cancel-delete").onclick = closeModal;
  document.getElementById("confirm-delete").onclick = () => {
    fn();
    addAudit("삭제 처리", detail);
    closeModal();
    render();
    toast("삭제 처리 완료 · 변경 기록 반영");
  };
}
function uploadDialog(index=null) {
 if(index!==null&&!state.admin)return;
 const m=index===null?null:materialData[index];
 const subjects=[...new Set([...Object.values(curriculum).flat().map(x=>x[0]),...materialData.map(x=>x.subject)])];
 openModal(m?'교재 파일 수정':'교재 업로드',`<form id="material-form"><div class="form-grid"><label class="wide">교과목<select name="subject">${subjects.map(x=>`<option ${x===m?.subject?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>강사<select name="teacherId">${people.filter(p=>!state.hiddenPeople.includes(p.id)).map(p=>`<option value="${p.id}" ${p.id===m?.teacherId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>${state.admin?`<label>공개 여부<select name="visibility"><option value="public">공개</option><option value="private" ${m?.public===false?'selected':''}>비공개</option></select></label>`:`<label>등록자 이름<input name="uploader" required maxlength="80" placeholder="등록자 이름"></label>`}${m?`<p class="wide file-name">현재 파일: ${esc(m.filename)}</p>`:''}<label class="wide">${m?'교체 파일 (선택)':'PPTX · PDF 파일'}<input type="file" name="file" accept=".pdf,.pptx" ${m?'':'required'}></label><label class="wide">변경 사유<input name="reason" required placeholder="등록 또는 수정 사유"></label></div><p class="privacy-info">선택한 파일은 브라우저 메모리에서만 관리합니다. 서버에 업로드되지 않으며 새로고침하면 초기화됩니다.</p><p id="file-error" role="alert"></p><div class="dialog-actions"><button class="primary" type="submit">${m?'변경 저장':'업로드'}</button></div></form>`);
 document.getElementById('material-form').onsubmit=e=>{
  e.preventDefault();const d=new FormData(e.target),f=d.get('file');
  if((!m&&!f?.size)||(f?.size && (!/\.(pdf|pptx)$/i.test(f.name)||f.size>50*1024*1024))){document.getElementById('file-error').textContent='PDF 또는 PPTX 파일을 50 MB 이하로 선택하세요.';return;}
  const next={...m,subject:d.get('subject'),teacherId:d.get('teacherId'),public:!state.admin||d.get('visibility')==='public'};
  if(f?.size){next.filename=f.name;next.format=f.name.split('.').at(-1).toUpperCase();next.size=(f.size/1024/1024).toFixed(2)+' MB';next.file=f;}
  if(m)materialData[index]=next;else materialData.push(next);
  addAudit(m?'교재 파일 수정':'교재 업로드',`${m?m.filename+' → ':''}${next.filename} / ${d.get('reason')} / 등록자: ${state.admin?'관리자':d.get('uploader')}`);
  closeModal();render();toast('교재 자료 저장 완료 · 목업 메모리 반영');
 };
}
function downloadDemo(filename) {
  const m=materialData.find(m=>m.filename===filename);
  if(m?.file){const url=URL.createObjectURL(m.file),a=document.createElement('a');a.href=url;a.download=m.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}

  openModal(
    "교재 내려받기",
    `<div class="lesson-detail">${icon("file")}<h3 style="overflow-wrap:anywhere">${esc(filename)}</h3></div><p class="intro">실제 파일 미연결<br>운영에서는 이 버튼으로 선택한 PDF 또는 PPTX를 내려받습니다.</p><p class="privacy-info">파일명에 과목·강사·버전을 남겨 같은 과목의 다른 강사 자료를 구분합니다.</p>`,
  );
}
function exportDemo() {
  const rows = [
    [
      "날짜",
      "지역",
      "기수",
      "트랙",
      "교과목",
      "강사",
      "소속",
      "배정 상태",
      "메모",
    ],
    ...selectedClasses()
      .flatMap((c) => scheduleDates().map((day) => lesson(c, day)))
      .filter(matches)
      .map((l) => [
        l.day,
        l.c.region,
        l.c.cohort,
        tracks[l.c.track].name,
        l.subject,
        people.find((p) => p.id === l.teacherId)?.name,
        org(l.org).name,
        l.status,
        noteFor(l),
      ]),
  ];
  const csv =
    "\ufeff" +
    rows
      .map((r) =>
        r
          .map((c) => '"' + String(c ?? "").replaceAll('"', '""') + '"')
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "K뉴딜_목업_시간표.csv";
  a.click();
  URL.revokeObjectURL(url);
  toast("예시 CSV 다운로드 완료");
}
function toast(text) {
  window.notifyLucian(text);
}
function bind() {
 const range=document.getElementById('schedule-range');
 if(range)range.onsubmit=e=>{e.preventDefault();const d=new FormData(range),start=d.get('start'),end=d.get('end');if(start>end||(new Date(end)-new Date(start))/86400000>365){document.getElementById('range-error').textContent='시작일 이후, 최대 366일 범위로 설정하세요.';return;}state.rangeStart=start;state.rangeEnd=end;render();};
 document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{if(b.dataset.period==='week')state.rangeEnd=moveDay(state.rangeStart,6);else{const d=new Date(state.rangeStart+'T12:00:00Z'),day=d.getUTCDate();d.setUTCMonth(d.getUTCMonth()+1,1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));state.rangeEnd=moveDay(d.toISOString().slice(0,10),-1);}render();});
 document.querySelectorAll('[data-edit-material]').forEach(b=>b.onclick=()=>uploadDialog(Number(b.dataset.editMaterial)));
 document.querySelectorAll('[data-delete-material]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.deleteMaterial),m=materialData[i];confirmDelete('교재 삭제',m.filename,()=>materialData.splice(i,1));});

  document.querySelectorAll("[data-dashboard-region]").forEach(
    (b) =>
      (b.onclick = () => {
        state.dashboardRegion = b.dataset.dashboardRegion;
        render();
      }),
  );

  document
    .querySelectorAll("[data-add-announcement]")
    .forEach((b) => (b.onclick = () => announcementEditor()));
  document
    .querySelectorAll("[data-edit-announcement]")
    .forEach(
      (b) => (b.onclick = () => announcementEditor(b.dataset.editAnnouncement)),
    );
  document.querySelectorAll("[data-delete-announcement]").forEach(
    (b) =>
      (b.onclick = () => {
        const n = announcements.find(
          (n) => n.id === b.dataset.deleteAnnouncement,
        );
        confirmDelete("공지 삭제", n.title, () =>
          announcements.splice(announcements.indexOf(n), 1),
        );
      }),
  );

  document.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.preventDefault();
        navigate(b.dataset.view);
      }),
  );
  document
    .querySelectorAll("[data-admin-login]")
    .forEach((b) => (b.onclick = login));
  document.querySelectorAll("[data-logout]").forEach(
    (b) =>
      (b.onclick = () => {
        state.admin = false;
        state.view = "dashboard";
        render();
        toast("공개 화면 전환");
      }),
  );
  document.querySelectorAll("[data-region]").forEach(
    (b) =>
      (b.onclick = () => {
        state.region = b.dataset.region;
        state.track = "";
        state.org = "";
        state.view = "region";
        syncUrl();
        render();
        window.scrollTo(0, 0);
      }),
  );
  document.querySelectorAll("[data-class]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = classes.find((c) => c.id === b.dataset.class);
        state.region = c.region;
        state.track = c.track;
        state.cohort = String(c.cohort);
        state.org = "";
        state.view = "region";
        syncUrl();
        render();
        window.scrollTo(0, 0);
      }),
  );
  document
    .querySelectorAll("[data-teacher]")
    .forEach((b) => (b.onclick = () => showTeacher(b.dataset.teacher)));
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onchange = () => {
        state[b.dataset.filter] = b.value;
        syncUrl();
        render();
      }),
  );
  document.querySelectorAll("[data-date]").forEach(
    (b) =>
      (b.onchange = () => {
        if (b.value) {
          state.date = b.value;
          render();
        }
      }),
  );
  document.querySelectorAll("[data-search]").forEach((b) => {
    b.onchange = () => {
      state.search = b.value;
      render();
    };
    b.onkeydown = (e) => {
      if (e.key === "Enter") {
        state.search = b.value;
        render();
      }
    };
  });
  document.querySelectorAll("[data-reset]").forEach(
    (b) =>
      (b.onclick = () => {
        state.region = state.view === "region" ? state.region : "";
        state.cohort = "2";
        state.track = "";
        state.org = "";
        state.search = "";
        state.week = 0;
        state.rangeStart="2026-11-02";state.rangeEnd="2026-11-06";
        syncUrl();
        render();
      }),
  );
  document.querySelectorAll("[data-week]").forEach(
    (b) =>
      (b.onclick = () => {
        state.rangeStart=moveDay(state.rangeStart,Number(b.dataset.week)*7);
        state.rangeEnd=moveDay(state.rangeEnd,Number(b.dataset.week)*7);
        render();
      }),
  );
  document.querySelectorAll("[data-this-week]").forEach(
    (b) =>
      (b.onclick = () => {
        state.week = 0;
        state.rangeStart="2026-11-02";state.rangeEnd="2026-11-06";
        render();
      }),
  );
  document.querySelectorAll("[data-mobile-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        state.mobileView = b.dataset.mobileMode;
        render();
      }),
  );
  document
    .querySelectorAll("[data-note]")
    .forEach((b) => (b.onclick = () => showNote(b.dataset.note)));
  document.querySelectorAll("[data-material-subject]").forEach(
    (b) =>
      (b.onclick = () => {
        state.view = "materials";
        state.search = b.dataset.materialSubject;
        render();
        window.scrollTo(0, 0);
      }),
  );
  document
    .querySelectorAll("[data-download]")
    .forEach((b) => (b.onclick = () => downloadDemo(b.dataset.download)));
  document
    .querySelectorAll("[data-export]")
    .forEach((b) => (b.onclick = exportDemo));
  document.querySelectorAll("[data-admin-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        state.adminTab = b.dataset.adminTab;
        state.region = "";
        state.track = "";
        state.org = "";
        render();
      }),
  );
  document
    .querySelectorAll("[data-add-class]")
    .forEach((b) => (b.onclick = () => classEditor()));
  document
    .querySelectorAll("[data-edit-class]")
    .forEach((b) => (b.onclick = () => classEditor(b.dataset.editClass)));
  document.querySelectorAll("[data-delete-class]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = classes.find((c) => c.id === b.dataset.deleteClass);
        confirmDelete(
          "과정 삭제",
          `${c.region} · ${c.cohort}기 · ${tracks[c.track].name}`,
          () => classes.splice(classes.indexOf(c), 1),
        );
      }),
  );
  document
    .querySelectorAll("[data-paste]")
    .forEach((b) => (b.onclick = () => pasteDialog(b.dataset.paste)));
  document
    .querySelectorAll("[data-edit-session]")
    .forEach(
      (b) => (b.onclick = () => sessionEditor(b.dataset.editSession || null)),
    );
  document
    .querySelectorAll("[data-add-teacher]")
    .forEach((b) => (b.onclick = () => teacherEditor()));
  document
    .querySelectorAll("[data-edit-teacher]")
    .forEach((b) => (b.onclick = () => teacherEditor(b.dataset.editTeacher)));
  document
    .querySelectorAll("[data-delete-teacher]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          confirmDelete(
            "강사 삭제",
            "강사 항목을 공개 목록에서 숨깁니다.",
            () => state.hiddenPeople.push(b.dataset.deleteTeacher),
          )),
    );
  document
    .querySelectorAll("[data-add-subject]")
    .forEach((b) => (b.onclick = () => subjectEditor()));
  document
    .querySelectorAll("[data-subject]")
    .forEach((b) => (b.onclick = () => subjectEditor(b.dataset.subject)));
  document.querySelectorAll("[data-delete-subject]").forEach(
    (b) =>
      (b.onclick = () => {
        const [t, i] = b.dataset.deleteSubject.split(":");
        confirmDelete(
          "과목 삭제",
          "과목과 연결된 시간표 영향 확인 단계가 필요합니다.",
          () =>
            (curriculum[t][Number(i)] = [
              "삭제된 과목(목업)",
              "기존 일정의 원문은 보존",
              "t1",
            ]),
        );
      }),
  );
  document
    .querySelectorAll("[data-upload]")
    .forEach((b) => (b.onclick = () => uploadDialog()));
}
document.addEventListener("keydown", (e) => {
  if (!modalRoot.firstChild) return;
  if(modalRoot.querySelector('.teacher-modal')) {
    if(['j','J','ArrowRight'].includes(e.key))document.getElementById('teacher-next')?.click();
    if(['k','K','ArrowLeft'].includes(e.key))document.getElementById('teacher-prev')?.click();
  }
  if (e.key === "Escape") {
    closeModal();
    return;
  }
  if (e.key === "Tab") {
    const nodes = [
      ...modalRoot.querySelectorAll("button,input,select,textarea,a[href]"),
    ].filter((n) => !n.disabled);
    if (!nodes.length) return;
    const first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
try {
  const q = new URLSearchParams(location.hash.slice(1));
  for (const key of ["view", "region", "cohort", "track", "org"])
    if (q.has(key)) state[key] = q.get(key);
  if (
    ![
      "dashboard",
      "schedule",
      "region",
      "teachers",
      "materials",
      "admin",
    ].includes(state.view)
  )
    state.view = "dashboard";
} catch {}
if (state.region && !["대전", "대구", "부산"].includes(state.region))
  state.region = "";
if (state.track && !tracks[state.track]) state.track = "";
if (state.org && !orgs.some((o) => o.id === state.org)) state.org = "";
if (state.cohort && !/^\d{1,2}$/.test(state.cohort)) state.cohort = "2";
render();

const portalBreakpoint=matchMedia('(max-width:700px)');
portalBreakpoint.addEventListener('change',()=>{if(state.view==='dashboard')render();});
