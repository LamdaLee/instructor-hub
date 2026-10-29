// Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070
window.mountLucian070 = function (root) {
  var zone = root.querySelector(".u070-zone"),
    empty = root.querySelector(".u070-empty"),
    live = root.querySelector(".u070-live");
  var rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ICON = {
    ok: '<svg viewBox="0 0 18 18"><path d="M4 9.4l3.2 3.2L14 5.6"/></svg>',
    err: '<svg viewBox="0 0 18 18"><path d="M9 5v5M9 13h.01"/></svg>',
    info: '<svg viewBox="0 0 18 18"><path d="M3.5 4.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg>',
    wait: "<i></i>",
  };
  var K = {
    ok: [
      "var(--ux-mint)",
      "변경 사항을 저장했어요",
      "목업에서만 변경 · 운영 DB에는 반영하지 않음",
    ],
    err: [
      "var(--ux-danger)",
      "업로드하지 못했어요",
      "네트워크 연결을 확인해 주세요",
      "다시 시도",
    ],
    info: [
      "var(--ux-accent)",
      "등록 정보가 갱신됐어요",
      "변경 기록에서 내용을 확인할 수 있어요",
      "보기",
    ],
    wait: ["var(--ux-warn)", "저장하는 중…", "파일 3개 · 12.4MB"],
  };
  var list = [],
    open = false,
    DUR = 4500,
    seq = 0;
  // 접혀 있을 때는 뒤 알림을 작게 겹치고, 펼치면 높이만큼 위로 쌓아 목록처럼 보여 줍니다
  function layout() {
    var acc = 0;
    list.forEach(function (t, i) {
      var el = t.el;
      el.classList.toggle("back", !open && i > 0);
      if (open) {
        el.style.setProperty("--y", -acc + "px");
        el.style.setProperty("--s", 1);
        el.style.setProperty("--o", 1);
        acc += el.offsetHeight + 8;
      } else {
        el.style.setProperty("--y", -(i * 14) + "px");
        el.style.setProperty("--s", (1 - i * 0.06).toFixed(2));
        el.style.setProperty("--o", i > 2 ? 0 : 1);
      }
      el.style.zIndex = 50 - i;
      el.inert = !open && i > 0;
    });
    empty.style.opacity = list.length ? "0" : "1";
    zone.style.pointerEvents = list.length ? "auto" : "none";
  }
  function remove(t, dir) {
    var i = list.indexOf(t);
    if (i < 0) return;
    list.splice(i, 1);
    t.el.classList.add("leave");
    if (dir) {
      t.el.style.setProperty("--dir", dir);
      t.el.classList.add("side");
    }
    setTimeout(function () {
      t.el.remove();
    }, 450);
    layout();
  }
  function push(k) {
    var d = K[k],
      el = document.createElement("div");
    el.className = "u070-t enter";
    el.style.setProperty("--c", d[0]);
    el.setAttribute("role", k === "err" ? "alert" : "status");
    el.innerHTML =
      '<span class="u070-ic" aria-hidden="true">' +
      ICON[k] +
      '</span><span class="u070-tx"><b></b><small></small></span>' +
      (d[3] ? '<button class="u070-act" type="button"></button>' : "") +
      '<button class="u070-x" type="button" aria-label="알림 닫기"><svg viewBox="0 0 14 14"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg></button><span class="u070-bar" aria-hidden="true"></span>';
    el.querySelector("b").textContent = d[1];
    el.querySelector("small").textContent = d[2];
    if (d[3]) el.querySelector(".u070-act").textContent = d[3];
    var t = { el: el, left: DUR, id: ++seq, k: k };
    zone.appendChild(el);
    list.unshift(t);
    void el.offsetWidth;
    el.classList.remove("enter");
    layout();
    live.textContent = d[1];
    el.querySelector(".u070-x").addEventListener("click", function () {
      remove(t);
    });
    if (d[3])
      el.querySelector(".u070-act").addEventListener("click", function () {
        remove(t);
        if (k === "err") push("wait");
      });
    // ‘저장 중’ 알림은 잠시 돌다가 완료 알림으로 바뀝니다
    if (k === "wait") {
      t.left = Infinity;
      setTimeout(
        function () {
          if (!root.isConnected || list.indexOf(t) < 0) return;
          el.style.setProperty("--c", K.ok[0]);
          el.querySelector(".u070-ic").innerHTML = ICON.ok;
          el.querySelector("b").textContent = "저장을 마쳤어요";
          el.querySelector("small").textContent = "파일 3개를 모두 올렸어요";
          live.textContent = "저장을 마쳤어요";
          t.left = DUR;
        },
        rm ? 300 : 1800,
      );
    }
    // 옆으로 밀어 닫기
    var sx = 0,
      dx = 0,
      down = false;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      down = true;
      sx = e.clientX;
      dx = 0;
      el.setPointerCapture(e.pointerId);
      el.classList.add("drag");
    });
    el.addEventListener("pointermove", function (e) {
      if (!down) return;
      dx = e.clientX - sx;
      el.style.setProperty("--dx", dx + "px");
      el.style.setProperty("--o", Math.max(0.2, 1 - Math.abs(dx) / 260));
    });
    var end = function () {
      if (!down) return;
      down = false;
      el.classList.remove("drag");
      if (Math.abs(dx) > 90) remove(t, dx > 0 ? 1 : -1);
      else {
        el.style.setProperty("--dx", "0px");
        layout();
      }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
  // 펼쳐 둔 동안은 남은 시간이 줄지 않습니다
  var last = performance.now();
  (function loop(now) {
    if (!root.isConnected) return;
    var dt = now - last;
    last = now;
    if (!open)
      list.slice().forEach(function (t, i) {
        if (i > 0 || t.left === Infinity) return;
        t.left -= dt;
        t.el.style.setProperty("--left", Math.max(0, t.left / DUR).toFixed(3));
        if (t.left <= 0) remove(t);
      });
    requestAnimationFrame(loop);
  })(last);
  function setOpen(v) {
    if (open === v) return;
    open = v;
    layout();
  }
  zone.addEventListener("pointerenter", function (e) {
    if (e.pointerType === "mouse") setOpen(true);
  });
  zone.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse" && !zone.contains(document.activeElement))
      setOpen(false);
  });
  zone.addEventListener("focusin", function () {
    setOpen(true);
  });
  zone.addEventListener("focusout", function (e) {
    if (!zone.contains(e.relatedTarget)) setOpen(false);
  });
  zone.addEventListener("click", function (e) {
    if (!e.target.closest("button") && list.length > 1) setOpen(!open);
  });
  root.querySelectorAll(".u070-btns button").forEach(function (b) {
    b.addEventListener("click", function () {
      push(b.getAttribute("data-k"));
    });
  });
  root.notify = function (text) {
    K.ok[1] = text;
    push("ok");
  };
  layout();
};
window.notifyLucian = function (text) {
  var root = document.getElementById("lucian-notifications");
  if (!root) {
    var host = document.createElement("div");
    host.innerHTML =
      '<div class="ux u070">\n  <div class="u070-btns" hidden>\n    <button type="button" data-k="ok" style="--c:var(--ux-mint)"><i aria-hidden="true"></i>저장 완료</button>\n    <button type="button" data-k="err" style="--c:var(--ux-danger)"><i aria-hidden="true"></i>오류</button>\n    <button type="button" data-k="info" style="--c:var(--ux-accent)"><i aria-hidden="true"></i>새 댓글</button>\n    <button type="button" data-k="wait" style="--c:var(--ux-warn)"><i aria-hidden="true"></i>저장 중…</button>\n  </div>\n  <div class="u070-zone" role="region" aria-label="알림" tabindex="-1">\n    <p class="u070-empty" hidden>변경 알림</p>\n    <div class="u070-live" aria-live="polite"></div>\n  </div>\n</div>';
    root = host.firstElementChild;
    root.id = "lucian-notifications";
    document.body.appendChild(root);
    window.mountLucian070(root);
  }
  root.notify(text);
};
