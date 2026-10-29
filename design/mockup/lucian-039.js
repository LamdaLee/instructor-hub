// Lucian UX/UI Prompt #039 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#039
window.lucian039Markup = () =>
  '<div class="ux u039">\n  <div class="u039-tabs" role="tablist" aria-label="강사 배정 상태">\n    <span class="u039-pill" aria-hidden="true"></span>\n    <button class="u039-tab" type="button" role="tab" aria-selected="true">전체</button>\n    <button class="u039-tab" type="button" role="tab" aria-selected="false">확정</button>\n    <button class="u039-tab" type="button" role="tab" aria-selected="false">임시</button>\n    <button class="u039-tab" type="button" role="tab" aria-selected="false">변경예정</button>\n  </div>\n  <div class="u039-panel" role="tabpanel"></div>\n</div>';
window.mountLucian039 = function (root) {
  var tabs = Array.prototype.slice.call(root.querySelectorAll(".u039-tab"));
  var pill = root.querySelector(".u039-pill");
  var panel = root.querySelector(".u039-panel");
  var rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var statuses = [null, "확정", "임시", "변경예정"];
  var DATA = statuses.map(function (status) {
    return classes
      .map(function (c) {
        return lesson(c, reference);
      })
      .filter(function (l) {
        return l && (!status || l.status === status);
      })
      .slice(0, 4)
      .map(function (l) {
        var p = people.find(function (p) {
          return p.id === l.teacherId;
        });
        var palette = {
          lge: "linear-gradient(140deg,#c998a7,#e6c7cd)",
          clips: "linear-gradient(140deg,#8fa5cd,#c0d0ed)",
          assist: "linear-gradient(140deg,#b4a0cf,#d8cee8)",
          lab: "linear-gradient(140deg,#8cb4a4,#c5ded3)",
          free: "linear-gradient(140deg,#a7b495,#d7ddc8)",
        };
        return [
          l.c.region + " · " + tracks[l.c.track].name,
          p.name + " · " + org(l.org).name,
          l.status,
          palette[l.org],
        ];
      });
  });
  var cur = 0,
    list = null;
  function movePill(animate) {
    var t = tabs[cur];
    if (!animate) pill.style.transition = "none";
    pill.style.setProperty("--x", t.offsetLeft + "px");
    pill.style.setProperty("--w", t.offsetWidth + "px");
    if (!animate) {
      void pill.offsetWidth;
      pill.style.transition = "";
    }
  }
  function make(i) {
    var ul = document.createElement("ul");
    ul.className = "u039-list";
    ul.innerHTML = DATA[i]
      .map(function (r, k) {
        return (
          '<li class="u039-row" style="transition-delay:' +
          k * 45 +
          'ms"><span class="u039-art" style="--g:' +
          r[3] +
          '" aria-hidden="true"></span><span><b>' +
          r[0] +
          (i === 0 && k === 0 ? '<span class="u039-badge">예시</span>' : "") +
          "</b><small>" +
          r[1] +
          "</small></span><em>" +
          r[2] +
          "</em></li>"
        );
      })
      .join("");
    if (!DATA[i].length)
      ul.innerHTML =
        '<li class="u039-row"><span><b>해당 배정이 없어요</b><small>다른 상태를 선택해 주세요.</small></span></li>';
    return ul;
  }
  // 새 목록은 이동한 방향에서 들어오고, 이전 목록은 반대쪽으로 빠집니다. 줄마다 조금씩 늦게 움직입니다
  function select(i, focus) {
    if (i === cur && list) return;
    var dir = i > cur ? 1 : -1;
    cur = i;
    tabs.forEach(function (t, k) {
      t.setAttribute("aria-selected", String(k === i));
      t.tabIndex = k === i ? 0 : -1;
    });
    panel.setAttribute("aria-label", tabs[i].textContent + " 배정 목록");
    if (focus) tabs[i].focus();
    movePill(true);
    var next = make(i),
      old = list;
    list = next;
    if (!old || rm) {
      if (old) old.remove();
      panel.appendChild(next);
      return;
    }
    Array.prototype.forEach.call(next.children, function (r) {
      r.style.transform = "translateX(" + dir * 70 + "%)";
      r.style.opacity = "0";
    });
    panel.appendChild(next);
    void next.offsetWidth;
    Array.prototype.forEach.call(next.children, function (r) {
      r.style.transform = "";
      r.style.opacity = "";
    });
    Array.prototype.forEach.call(old.children, function (r) {
      r.style.transform = "translateX(" + -dir * 60 + "%)";
      r.style.opacity = "0";
    });
    setTimeout(function () {
      old.remove();
    }, 700);
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () {
      select(i);
    });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) {
        e.preventDefault();
        select((i + d + tabs.length) % tabs.length, true);
      }
    });
  });
  var uid = "u039-" + Math.random().toString(36).slice(2, 7);
  panel.id = uid;
  tabs.forEach(function (t) {
    t.setAttribute("aria-controls", uid);
  });
  list = make(0);
  panel.appendChild(list);
  tabs.forEach(function (t, k) {
    t.tabIndex = k === 0 ? 0 : -1;
  });
  movePill(false);
};
