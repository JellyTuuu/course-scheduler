// src/App.jsx
import { useState } from "react";
import { fetchSchedules } from "./api";
import Tesseract from "tesseract.js";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_START_MIN = 8 * 60;   // 08:00
const DAY_END_MIN = 20 * 60;    // 20:00

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** 日历视图组件：展示一套 schedule */
/** 日历视图组件：展示一套 schedule */
function ScheduleCalendar({ schedule }) {
  if (!schedule || schedule.length === 0) {
    return <p className="muted">暂无可展示的课表。</p>;
  }

  // 先按课程名排序，方便看
  const sorted = [...schedule].sort((a, b) =>
    a.courseId.localeCompare(b.courseId)
  );

  return (
    <div className="calendar">
      {/* 左边时间刻度 */}
      <div className="calendar-times">
        {Array.from({ length: DAY_END_MIN - DAY_START_MIN + 1 }, (_, i) => {
          const minutes = DAY_START_MIN + i * 60;
          if (minutes > DAY_END_MIN) return null;
          const h = Math.floor(minutes / 60);
          const label = `${h.toString().padStart(2, "0")}:00`;
          return (
            <div key={label} className="calendar-time-row">
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      {/* 右侧 5 列: Mon–Fri */}
      <div className="calendar-grid">
        {/* 顶部 weekday 标题 */}
        {DAY_LABELS.map((day) => (
          <div key={day} className="calendar-day-header">
            {day}
          </div>
        ))}

        {/* 每一列是一个 day column，内层 absolute 放事件块 */}
        {DAY_LABELS.map((day, colIndex) => (
          <div key={day} className="calendar-day-column">
            {/* 背景时间刻度线 */}
            {Array.from({ length: DAY_END_MIN - DAY_START_MIN + 1 }, (_, i) => {
              const minutes = DAY_START_MIN + i * 60;
              if (minutes > DAY_END_MIN) return null;
              const key = `${day}-${minutes}`;
              return <div key={key} className="calendar-slot" />;
            })}

            {/* 该天的所有课 */}
            {sorted.map((sec, idx) =>
              sec.times
                .filter((t) => t.day === day)
                .map((t, j) => {
                  const start = Math.max(timeToMinutes(t.start), DAY_START_MIN);
                  const end = Math.min(timeToMinutes(t.end), DAY_END_MIN);
                  const total = DAY_END_MIN - DAY_START_MIN;
                  const top = ((start - DAY_START_MIN) / total) * 100;
                  let height = ((end - start) / total) * 100;

                // 如果你担心特别短的课太细，可以给一个很小的下限，比如 3%
                const MIN_HEIGHT_PERCENT = 3; // ≈ 21 分钟
                if (height < MIN_HEIGHT_PERCENT) {
                height = MIN_HEIGHT_PERCENT;
                }
                  const colorIndex = (idx + j) % 5;
                  const colorClass = `event-color-${colorIndex}`;

                                    // 优先用 time 上的 label（LEC 001 / DIS 302），没有就退回整个 sectionId
                  const sectionLabel = t.label || sec.sectionId || "Section";

                  return (
                    <div
                      key={`${sec.sectionId}-${t.day}-${j}`}
                      className={`calendar-event ${colorClass}`}
                      style={{ top: `${top}%`, height: `${height}%` }}
                    >
                      <div className="calendar-event-title">
                        {/* 例如：JTOCN101 · LEC 001 或 JTOCN101 · DIS 302 */}
                        {sec.courseId} · {sectionLabel}
                      </div>
                      <div className="calendar-event-sub">
                        {t.start}–{t.end}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 专门适配 UW Sections OCR 文本
function parseCoursesFromText(rawText) {
  // 先统一转成大写，方便匹配
  const text = rawText.toUpperCase();

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // ---------- 1️⃣ 识别课程号：尽量从 “... SECTIONS” 那一行抓 ----------
  let courseId = "COURSE";
  let courseName = "COURSE";

  const headerLine = lines.find((l) => l.includes("SECTIONS"));

  function setCourseFromMatch(m1, m2, m3) {
    if (m1 && m2 && m3) {
      courseName = `${m1} ${m2} ${m3}`; // ATM OCN 101
      courseId = `${m1}${m2}${m3}`;     // ATMOCN101
    }
  }

  if (headerLine) {
    // 形式：ATM OCN 101: SECTIONS
    let m = headerLine.match(/([A-Z]{2,4})\s+([A-Z]{2,4})\s+(\d{3})/);
    if (m) {
      setCourseFromMatch(m[1], m[2], m[3]);
    } else {
      // 形式：MATH 340: SECTIONS
      const m2 = headerLine.match(/([A-Z]{2,6})\s+(\d{3})/);
      if (m2 && !["LEC", "DIS", "LAB", "SEM"].includes(m2[1])) {
        courseName = `${m2[1]} ${m2[2]}`;
        courseId = `${m2[1]}${m2[2]}`;
      }
    }
  }

  // 如果还没识别出来，再在全文里找一次，但过滤掉 LEC/DIS/LAB/SEM 这些前缀
  if (courseId === "COURSE") {
    const badPrefixes = ["LEC", "DIS", "LAB", "SEM"];
    const allMatches = [...text.matchAll(/([A-Z]{2,6})\s+(\d{3})/g)];
    const good = allMatches.find((m) => !badPrefixes.includes(m[1]));
    if (good) {
      courseName = `${good[1]} ${good[2]}`;
      courseId = `${good[1]}${good[2]}`;
    }
  }

  // 如果实在找不到，就退回默认
  if (courseId === "COURSE") {
    courseId = "UNKNOWN";
    courseName = "Unknown Course";
  }

  // ---------- 2️⃣ 下面是 LEC / DIS / LAB 的解析和组合 ----------
  const dayCodeMap = { M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri" };

  function parseTimesFromLine(line) {
    const timeMatch = line.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!timeMatch) return null;

    const startRaw = timeMatch[1];
    const endRaw = timeMatch[2];

    const beforeTime = line.slice(0, timeMatch.index);
    const dayTokenMatches = beforeTime.match(/([MTWRF]+)/g);
    if (!dayTokenMatches || dayTokenMatches.length === 0) return null;
    const dayToken = dayTokenMatches[dayTokenMatches.length - 1];

    const days = [];
    for (const ch of dayToken.split("")) {
      if (dayCodeMap[ch]) {
        days.push(dayCodeMap[ch]);
      }
    }
    if (days.length === 0) return null;

    const norm = (t) => (t.length === 4 ? `0${t}` : t);
    const start = norm(startRaw);
    const end = norm(endRaw);

    return days.map((d) => ({ day: d, start, end }));
  }

  const lectures = [];
  const others = [];

  for (const line of lines) {
    const secMatch = line.match(/\b(LEC|DIS|LAB|SEM)\s*([0-9O]{2,4})/);
    if (!secMatch) continue;

    const secType = secMatch[1];
    let rawNum = secMatch[2];

    rawNum = rawNum.replace(/O/g, "0");
    const num = rawNum.padStart(3, "0").slice(-3);

    const sectionId = `${secType} ${num}`;
    const times = parseTimesFromLine(line);
    if (!times) continue;

    const secObj = { sectionId, type: secType, times };

    if (secType === "LEC") {
      lectures.push(secObj);
    } else {
      others.push(secObj);
    }
  }

  if (lectures.length === 0 && others.length === 0) {
    return [];
  }

  const sections = [];

  // 有 LEC + DIS/LAB：做所有组合
  if (lectures.length > 0 && others.length > 0) {
    for (const lec of lectures) {
      for (const other of others) {
        sections.push({
          sectionId: `${lec.sectionId} + ${other.sectionId}`,
          times: [
            ...lec.times.map((t) => ({ ...t, label: lec.sectionId })),   // LEC 001
            ...other.times.map((t) => ({ ...t, label: other.sectionId })), // DIS 302
          ],
        });
      }
    }
  } else {
    // 否则每个独立 section
    for (const s of [...lectures, ...others]) {
      sections.push({
        sectionId: s.sectionId,
        times: s.times,
      });
    }
  }

  return [
    {
      courseId,
      name: courseName,
      sections,
    },
  ];
}
function App() {
  // 所有课程（每个课程可有多个 section）
  const [courses, setCourses] = useState([]);
    // OCR 相关 state
  const [ocrImage, setOcrImage] = useState(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
    const handleOcrFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setOcrImage(null);
      setOcrPreviewUrl("");
      return;
    }
    setOcrImage(file);
    const url = URL.createObjectURL(file);
    setOcrPreviewUrl(url);
    setOcrText(""); // 选了新图，清空旧识别结果
  };

  const handleRunOcr = async () => {
    if (!ocrImage) {
      alert("请先选择一张选课页面截图");
      return;
    }
    setOcrLoading(true);
    try {
      const { data } = await Tesseract.recognize(ocrImage, "eng", {
        logger: () => {},
      });
      setOcrText(data.text || "");
    } catch (e) {
      console.error(e);
      alert("识别失败，可以稍后重试，或者换一张更清晰的截图。");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleImportCoursesFromOcr = () => {
    if (!ocrText.trim()) {
      alert("还没有识别出的文字，请先点击“识别文本”。");
      return;
    }
    const parsed = parseCoursesFromText(ocrText);
    if (parsed.length === 0) {
      alert("暂时没能从识别结果里解析出课程。\n你可以先看下面的原始文本，再考虑微调截图格式或手动录入。");
      return;
    }
    setCourses((prev) => {
  // 先把已有课程放到 map 里
  const map = new Map();
  for (const c of prev) {
    map.set(c.courseId, { ...c, sections: [...c.sections] });
  }

  // 再把本次解析出来的课程合并进去
  for (const nc of parsed) {
    const existing = map.get(nc.courseId);
    if (!existing) {
      // 之前没有这门课，直接加
      map.set(nc.courseId, nc);
    } else {
      // 已经有这门课了，合并 section，按 sectionId 去重
      const mergedSections = [...existing.sections];
      for (const ns of nc.sections) {
        const dup = mergedSections.some((s) => s.sectionId === ns.sectionId);
        if (!dup) {
          mergedSections.push(ns);
        }
      }
      map.set(nc.courseId, { ...existing, sections: mergedSections });
    }
  }

  return Array.from(map.values());
});

    alert(
    `已从截图中导入/更新 ${parsed.length} 门课程。\n` +
    `如果这门课还有没截完的 section，可以继续上传下一张截图并导入，系统会自动合并到同一门课里。`
);  };

  // 正在编辑的课程基础信息
  const [courseInfo, setCourseInfo] = useState({
    courseId: "",
    name: "",
  });

  // 当前正在编辑的一个 section 表单
  const [sectionForm, setSectionForm] = useState({
    days: { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false },
    start: "09:00",
    end: "10:00",
  });

  // 当前课程已添加的 section 列表
  const [editingSections, setEditingSections] = useState([]);

  // 偏好
  const [preferences, setPreferences] = useState({
    earliest: "09:00",
    latest: "18:00",
    noFriday: false,
  });

  // 结果
  const [result, setResult] = useState(null);
  const [scheduleIndex, setScheduleIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // 添加一个 section 到当前课程
  const handleAddSection = () => {
    const selectedDays = Object.entries(sectionForm.days)
      .filter(([_, checked]) => checked)
      .map(([day]) => day);

    if (selectedDays.length === 0) {
      alert("请至少为这个 section 选择一个上课日");
      return;
    }

    const section = {
      sectionId: `SEC-${Date.now()}-${editingSections.length + 1}`,
      times: selectedDays.map((day) => ({
        day,
        start: sectionForm.start,
        end: sectionForm.end,
      })),
    };

    setEditingSections((prev) => [...prev, section]);

    setSectionForm({
      days: { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false },
      start: "09:00",
      end: "10:00",
    });
  };

  // 删除正在编辑课程里的一个 section
  const handleRemoveEditingSection = (sectionId) => {
    setEditingSections((prev) => prev.filter((s) => s.sectionId !== sectionId));
  };

  // 保存整门课程
  const handleSaveCourse = () => {
    if (!courseInfo.courseId.trim()) {
      alert("请输入课程代号（例如 MATH340）");
      return;
    }
    if (editingSections.length === 0) {
      alert("请至少为这门课添加一个 section");
      return;
    }

    const courseObj = {
      courseId: courseInfo.courseId.trim(),
      name: courseInfo.name.trim() || courseInfo.courseId.trim(),
      sections: editingSections,
    };

    setCourses((prev) => [...prev, courseObj]);

    // 重置
    setCourseInfo({ courseId: "", name: "" });
    setEditingSections([]);
    setSectionForm({
      days: { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false },
      start: "09:00",
      end: "10:00",
    });
  };

  // 删除一整门课
  const handleRemoveCourse = (courseId) => {
    setCourses((prev) => prev.filter((c) => c.courseId !== courseId));
  };

  // 生成课表
  const handleGenerate = async () => {
    if (courses.length === 0) {
      alert("请先添加至少一门课程");
      return;
    }

    setLoading(true);
    try {
      const data = await fetchSchedules(courses, preferences);
      setResult(data);
      setScheduleIndex(0);
    } catch (e) {
      console.error(e);
      alert("生成课表失败，请检查后端是否在运行");
    } finally {
      setLoading(false);
    }
  };

  const currentSchedule =
    result && result.schedules && result.schedules[scheduleIndex]
      ? result.schedules[scheduleIndex]
      : null;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Smart Scheduler</h1>
          <p className="subtitle">
            手动录入课程 + 多 section，自动生成不冲突课表，支持偏好与日历视图。
          </p>
        </div>
        <div className="stats">
          <div className="stat-item">
            <span className="stat-label">课程数</span>
            <span className="stat-value">{courses.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">组合数</span>
            <span className="stat-value">{result?.count ?? 0}</span>
          </div>
        </div>
      </header>

      <div className="layout">
        {/* 左侧：控制面板 */}
        <aside className="sidebar">
          <section className="card">
            <h2 className="section-title">1. 编辑课程 & section</h2>

            <label className="field">
              <span>课程代号</span>
              <input
                value={courseInfo.courseId}
                onChange={(e) =>
                  setCourseInfo((c) => ({ ...c, courseId: e.target.value }))
                }
                placeholder="如 MATH340"
              />
            </label>

            <label className="field">
              <span>课程名称（可选）</span>
              <input
                value={courseInfo.name}
                onChange={(e) =>
                  setCourseInfo((c) => ({ ...c, name: e.target.value }))
                }
                placeholder="如 Elementary Linear Algebra"
              />
            </label>

            <div className="subsection">
              <div className="subsection-header">
                <span className="subsection-title">添加一个 section</span>
                <span className="chip">多节课的核心痛点</span>
              </div>

              <div className="field">
                <span>上课日</span>
                <div className="days-row">
                  {DAY_LABELS.map((day) => (
                    <label key={day} className="day-chip">
                      <input
                        type="checkbox"
                        checked={sectionForm.days[day]}
                        onChange={(e) =>
                          setSectionForm((c) => ({
                            ...c,
                            days: { ...c.days, [day]: e.target.checked },
                          }))
                        }
                      />
                      <span>{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="field field-inline">
                <div>
                  <span>开始时间</span>
                  <input
                    type="time"
                    value={sectionForm.start}
                    onChange={(e) =>
                      setSectionForm((c) => ({ ...c, start: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <span>结束时间</span>
                  <input
                    type="time"
                    value={sectionForm.end}
                    onChange={(e) =>
                      setSectionForm((c) => ({ ...c, end: e.target.value }))
                    }
                  />
                </div>
              </div>

              <button className="btn btn-outline" onClick={handleAddSection}>
                ➕ 添加这个 section
              </button>

              <div className="section-list">
                <div className="subsection-header mt-8">
                  <span className="subsection-title">
                    当前课程已添加的 section
                  </span>
                  <span className="muted">
                    共 {editingSections.length} 个 section
                  </span>
                </div>
                {editingSections.length === 0 && (
                  <p className="muted">还没有 section，请先添加。</p>
                )}
                {editingSections.map((sec) => (
                  <div key={sec.sectionId} className="row-between row-item">
                    <span>
                      {sec.times
                        .map((t) => `${t.day} ${t.start}-${t.end}`)
                        .join(" · ")}
                    </span>
                    <button
                      className="link-button"
                      onClick={() => handleRemoveEditingSection(sec.sectionId)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn-primary full-width" onClick={handleSaveCourse}>
              ✅ 保存这门课
            </button>
          </section>

          <section className="card">
            <h2 className="section-title">2. 时间偏好</h2>

            <div className="field field-inline">
              <div>
                <span>不早于</span>
                <input
                  type="time"
                  value={preferences.earliest}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, earliest: e.target.value }))
                  }
                />
              </div>
              <div>
                <span>不晚于</span>
                <input
                  type="time"
                  value={preferences.latest}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, latest: e.target.value }))
                  }
                />
              </div>
            </div>

            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={preferences.noFriday}
                onChange={(e) =>
                  setPreferences((p) => ({ ...p, noFriday: e.target.checked }))
                }
              />
              <span>不上周五</span>
            </label>

            <button
              className="btn btn-accent full-width"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? "生成中..." : "3. 生成不冲突课表组合"}
            </button>
          </section>
                    <section className="card">
            <h2 className="section-title">3. 从选课截图导入（可选）</h2>
            <p className="muted" style={{ marginBottom: 4 }}>
            适合你已经在学校系统里选好课，在这里截图自动识别课程和时间。
            </p>
            <p className="muted" style={{ marginBottom: 8, fontSize: 12 }}>
            同一门课可以分多张截图上传：每次「识别文本 → 导入课程」后，
            如果这门课还有没截完的 section，可以继续上传下一张截图，
            系统会自动把同一门课的 section 合并在一起。
            </p>

            <div className="field">
              <span>上传选课页面截图（清晰一点）</span>
              <input type="file" accept="image/*" onChange={handleOcrFileChange} />
            </div>

            {ocrPreviewUrl && (
              <div style={{ marginBottom: 8 }}>
                <span className="muted">预览：</span>
                <div
                  style={{
                    marginTop: 4,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(55,65,81,0.9)",
                  }}
                >
                  <img
                    src={ocrPreviewUrl}
                    alt="screenshot preview"
                    style={{ width: "100%", maxHeight: 200, objectFit: "cover" }}
                  />
                </div>
              </div>
            )}

            <button
              className="btn btn-outline full-width"
              onClick={handleRunOcr}
              disabled={ocrLoading || !ocrImage}
            >
              {ocrLoading ? "识别中..." : "🔍 识别截图中的文本"}
            </button>

            {ocrText && (
              <>
                <div className="field" style={{ marginTop: 10 }}>
                  <span>识别结果（原始文本）</span>
                  <textarea
                    value={ocrText}
                    onChange={(e) => setOcrText(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 80,
                      borderRadius: 8,
                      border: "1px solid rgba(75,85,99,0.9)",
                      background: "#020617",
                      color: "#f9fafb",
                      fontSize: 12,
                      padding: 6,
                      resize: "vertical",
                    }}
                  />
                </div>

                <button
                  className="btn btn-primary full-width"
                  style={{ marginTop: 6 }}
                  onClick={handleImportCoursesFromOcr}
                >
                  ⬇️ 尝试将上面的文本解析为课程并导入
                </button>
                <p className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                  解析规则目前比较简单，只能支持类似
                  “MATH 340 MWF 09:55-10:45”、
                  “CS400 TR 11:00-12:15” 这种格式。
                  导入后你可以在右边课程列表里检查和手动微调。
                </p>
              </>
            )}
          </section>
        </aside>

        {/* 右侧：结果 + 日历视图 */}
        <main className="main">
          <section className="card">
            <h2 className="section-title">已添加课程</h2>
            {courses.length === 0 && (
              <p className="muted">还没有课程，请在左侧完成“编辑课程 & section”。</p>
            )}
            {courses.map((c) => (
              <div key={c.courseId} className="course-card">
                <div className="row-between">
                  <div>
                    <div className="course-title">
                      {c.courseId} · {c.name}
                    </div>
                    <div className="course-meta">
                      {c.sections.length} 个 section
                    </div>
                  </div>
                  <button
                    className="btn btn-small btn-outline-danger"
                    onClick={() => handleRemoveCourse(c.courseId)}
                  >
                    删除课程
                  </button>
                </div>
                <div className="course-sections">
                  {c.sections.map((sec, idx) => (
                    <div key={sec.sectionId} className="course-section-chip">
                      <span className="chip-label">{sec.sectionId}</span>
                      <span>
                        {sec.times
                          .map((t) => `${t.day} ${t.start}-${t.end}`)
                          .join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="row-between">
              <h2 className="section-title">4. 课表结果 & 日历视图</h2>
              {result && result.count > 0 && (
                <div className="schedule-selector">
                  <span className="muted">方案选择：</span>
                  <select
                    value={scheduleIndex}
                    onChange={(e) => setScheduleIndex(Number(e.target.value))}
                  >
                    {result.schedules.map((_, idx) => (
                      <option key={idx} value={idx}>
                        方案 {idx + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {!result && (
              <p className="muted">
                还没有结果，请先添加课程、设置偏好，然后点击“生成不冲突课表组合”。
              </p>
            )}

            {result && (
              <>
                <p className="muted">
                  共找到 <strong>{result.count}</strong> 种不冲突的课表组合。
                  当前展示的是 <strong>方案 {scheduleIndex + 1}</strong>。
                </p>

                {/* 日历视图 */}
                <ScheduleCalendar schedule={currentSchedule} />

                {/* 列表视图 */}
                <div className="list-view">
                  <h3 className="subsection-title">列表视图</h3>
                  {currentSchedule?.map((sec) => (
                    <div key={sec.sectionId} className="list-card">
                      <div className="list-title">
                        {sec.courseId} {sec.courseName} - {sec.sectionId}
                      </div>
                      <ul>
                        {sec.times.map((t, i) => (
                          <li key={i}>
                            {t.day} {t.start}–{t.end}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;