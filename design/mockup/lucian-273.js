// Lucian UX/UI Prompt #273 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#273
window.lucian273Markup = () =>
  '<div class="ux u273">\n  <div class="u273-hd">강사 목록</div>\n  <ul class="u273-ls"></ul>\n  <div class="u273-ov" aria-hidden="true"></div>\n  <aside class="u273-pn" role="dialog" aria-label="강사 상세 정보" aria-hidden="true" tabindex="-1">\n    <div class="u273-tb"><button type="button" class="u273-pv" aria-label="이전 강사"><svg viewBox="0 0 11 11" aria-hidden="true"><path d="M2 7l3.5-3.5L9 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button type="button" class="u273-nx" aria-label="다음 강사"><svg viewBox="0 0 11 11" aria-hidden="true"><path d="M2 4l3.5 3.5L9 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="u273-ix"></span><button type="button" class="u273-x" aria-label="패널 닫기"><svg viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 2.5l6 6M8.5 2.5l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>\n    <div class="u273-bd" aria-live="polite"></div>\n  </aside>\n</div>';
window.mountLucian273 = function (root) {
  var ls = root.querySelector(".u273-ls"),
    pn = root.querySelector(".u273-pn"),
    bd = root.querySelector(".u273-bd"),
    ix = root.querySelector(".u273-ix"),
    pv = root.querySelector(".u273-pv"),
    nx = root.querySelector(".u273-nx"),
    x = root.querySelector(".u273-x"),
    ov = root.querySelector(".u273-ov");
  var rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // [이름, 회사, 요금제, 누적 결제, 팀원 수]
  var C = people
    .filter(function (p) {
      return (
        !state.hiddenPeople.includes(p.id) &&
        (!state.org || p.org === state.org) &&
        (!state.search || (p.name + p.subjects).includes(state.search))
      );
    })
    .map(function (p) {
      return [
        p.name,
        org(p.org).name,
        p.subjects,
        "010-0000-0000",
        "example@example.invalid",
        p.memo,
        p.id,
      ];
    });
  var COL = ["#b58090", "#7d9bbf", "#85a695", "#b2a07d", "#9a8bb5"];
  var ACT = [
    "요금제를 올렸어요",
    "팀원 2명을 초대했어요",
    "결제 수단을 바꿨어요",
  ];
  var R = C.map(function (c, i) {
    var li = document.createElement("li"),
      b = document.createElement("button");
    b.type = "button";
    b.className = "u273-rw";
    b.innerHTML =
      '<span class="u273-av" style="background:' +
      COL[i % COL.length] +
      '"></span><div><b></b><small></small></div><em></em>';
    b.querySelector(".u273-av").textContent = c[0].charAt(0);
    b.querySelector("b").textContent = c[0];
    b.querySelector("small").textContent = c[1];
    b.querySelector("em").textContent = "공개";
    b.addEventListener("click", function () {
      show(i, 0);
    });
    li.appendChild(b);
    ls.appendChild(li);
    return b;
  });
  var cur = -1;
  function page(i) {
    var c = C[i],
      d = document.createElement("div");
    d.className = "u273-pg";
    d.innerHTML =
      '<span class="u273-av" style="background:' +
      COL[i % COL.length] +
      '"></span><h4></h4><small></small><div class="u273-kv"><div><small></small><b></b></div><div><small></small><b></b></div></div><h5></h5>';
    d.querySelector(".u273-av").textContent = c[0].charAt(0);
    d.querySelector("h4").textContent = c[0];
    d.querySelector("small").textContent = c[1] + " · " + "공개";
    var kv = d.querySelectorAll(".u273-kv div");
    kv[0].querySelector("small").textContent = "전화번호";
    kv[0].querySelector("b").textContent = c[3];
    kv[1].querySelector("small").textContent = "이메일";
    kv[1].querySelector("b").textContent = c[4];
    d.querySelector("h5").textContent = "담당 과목 · 공개 안내 메모";
    [c[2], c[5], "연락처는 모두 목업용 가상 정보입니다."].forEach(
      function (a, k) {
        var p = document.createElement("div");
        p.className = "u273-ac";
        p.textContent = a;
        d.appendChild(p);
      },
    );
    return d;
  }
  // 다음은 아래에서, 이전은 위에서 들어오게 갈아 끼웁니다
  function show(i, dir) {
    var open = root.classList.contains("is-open");
    if (i === cur && open) return;
    var old = bd.firstChild,
      nw = page(i);
    if (old && open && dir && !rm) {
      nw.classList.add("is-in");
      nw.style.transform = "translateY(" + dir * 40 + "px)";
      nw.style.opacity = "0";
      bd.appendChild(nw);
      void nw.offsetWidth;
      nw.classList.remove("is-in");
      nw.style.transform = "";
      nw.style.opacity = "";
      old.style.transform = "translateY(" + -dir * 40 + "px)";
      old.style.opacity = "0";
      setTimeout(function () {
        old.remove();
      }, 420);
    } else {
      bd.innerHTML = "";
      bd.appendChild(nw);
    }
    cur = i;
    R.forEach(function (b, k) {
      b.classList.toggle("is-on", k === i);
      b.setAttribute("aria-current", k === i ? "true" : "false");
    });
    ix.textContent = i + 1 + " / " + C.length;
    pv.disabled = i === 0;
    nx.disabled = i === C.length - 1;
    root.classList.add("is-open");
    pn.setAttribute("aria-hidden", "false");
    pn.inert = false;
    pn.focus({ preventScroll: true });
  }
  function close() {
    root.classList.remove("is-open");
    pn.setAttribute("aria-hidden", "true");
    pn.inert = true;
    if (cur >= 0) R[cur].focus({ preventScroll: true });
  }
  pv.addEventListener("click", function () {
    if (cur > 0) show(cur - 1, -1);
  });
  nx.addEventListener("click", function () {
    if (cur < C.length - 1) show(cur + 1, 1);
  });
  x.addEventListener("click", close);
  ov.addEventListener("click", close);
  root.addEventListener("keydown", function (e) {
    if (!root.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "j" || e.key === "J") nx.click();
    if (e.key === "k" || e.key === "K") pv.click();
  });

  pn.inert = true;
  root.openTeacher = function (id) {
    var i = C.findIndex(function (c) {
      return c[6] === id;
    });
    if (i >= 0) show(i, 0);
  };
};
