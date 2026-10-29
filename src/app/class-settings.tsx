"use client";
import { useState } from "react";
import { type Row, post, classLabel } from "@/lib/client";
import VenueOverrides from "./venue-overrides";
import { DataTable, Modal } from "./components";
export default function ClassSettings({
  options,
  onDone,
}: {
  options: Row;
  onDone: () => void;
}) {
  const [region, setRegion] = useState(""),
    [cohort, setCohort] = useState(""),
    [editing, setEditing] = useState<Row>(),
    [venueClass, setVenueClass] = useState<Row>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  const rows = options.classes.filter(
    (c: Row) =>
      (!region || c.region === region) &&
      (!cohort || String(c.cohort) === cohort),
  );
  return (
    <section className="class-settings">
      <p className="privacy-info">
        반별 기본 강의장과 담당 매니저를 관리합니다. 평택 입소나 임시 이동은
        날짜별 강의장에 기간으로 등록하세요. 수업별로 지정한 장소가 가장 먼저 적용됩니다.
      </p>
      <div className="toolbar">
        <label>
          지역
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">전체 지역</option>
            {options.regions.map((r: string) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          기수
          <select value={cohort} onChange={(e) => setCohort(e.target.value)}>
            <option value="">전체 기수</option>
            {(
              [
                ...new Set(options.classes.map((c: Row) => c.cohort)),
              ] as number[]
            )
              .sort((a, b) => b - a)
              .map((c) => (
                <option key={c} value={c}>
                  {c}기
                </option>
              ))}
          </select>
        </label>
      </div>
      {saved && (
        <p className="settings-saved" role="status">
          {saved}
        </p>
      )}
      <DataTable
        rows={rows}
        columns={[
          ["region", "지역"],
          ["cohort", "기수", (r) => r.cohort + "기"],
          [
            "name",
            "반 · 트랙",
            (r) => (
              <>
                <strong>{r.name}</strong>
                <small>
                  {r.track}
                  {r.active ? "" : " · 비활성"}
                </small>
              </>
            ),
          ],
          ["manager", "담당 매니저", (r) => r.manager || "미등록"],
          ["room", "기본 강의장", (r) => r.room || "미등록"],
          [
            "edit",
            "관리",
            (r) => (
              <div className="toolbar">
              <button
                className="secondary"
                onClick={() => {
                  setError("");
                  setSaved("");
                  setEditing(r);
                }}
              >
                강의장·매니저 수정
              </button>
              <button className="secondary" onClick={() => setVenueClass(r)}>날짜별 강의장</button>
              </div>
            ),
          ],
        ]}
      />
      {venueClass && <VenueOverrides classRow={venueClass}
        rows={(options.venue_overrides || []).filter((r: Row) => r.class_id === venueClass.id)}
        onDone={onDone} close={() => setVenueClass(undefined)} />}
      {editing && (
        <Modal
          title="강의장·매니저 수정"
          close={() => {
            if (!busy) setEditing(undefined);
          }}
        >
          <p className="privacy-info">{classLabel(editing)}</p>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const d = new FormData(e.currentTarget);
              try {
                await post("save", {
                  kind: "class_settings",
                  data: {
                    id: editing.id,
                    manager: d.get("manager"),
                    room: d.get("room"),
                  },
                });
                setSaved(
                  "강의장·담당 매니저를 저장했습니다. 변경 기록에 반영했습니다.",
                );
                onDone();
                setEditing(undefined);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              담당 매니저
              <input
                name="manager"
                maxLength={200}
                defaultValue={editing.manager || ""}
                placeholder="담당 매니저 이름"
              />
            </label>
            <label>
              기본 강의장
              <input
                name="room"
                maxLength={200}
                defaultValue={editing.room || ""}
                placeholder="예: 대전 301호"
              />
            </label>
            {error && (
              <p className="error wide" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy}>{busy ? "저장 중…" : "저장"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
