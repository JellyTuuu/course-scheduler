// backend/server.js
const express = require("express");
const cors = require("cors");
const { courses } = require("./data");

const app = express();
app.use(cors());
app.use(express.json());

// 把 "HH:MM" 转成分钟数，方便比较
function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 检查两个 time slot 是否冲突（同一天且时间区间重叠）
function timeSlotsConflict(a, b) {
  if (a.day !== b.day) return false;
  const s1 = timeToMinutes(a.start);
  const e1 = timeToMinutes(a.end);
  const s2 = timeToMinutes(b.start);
  const e2 = timeToMinutes(b.end);
  return !(e1 <= s2 || e2 <= s1); // 有重叠则冲突
}

// 检查一个 section 是否与已有 section 列表冲突
function sectionConflictsWithSchedule(section, currentSections) {
  for (const existing of currentSections) {
    for (const t1 of section.times) {
      for (const t2 of existing.times) {
        if (timeSlotsConflict(t1, t2)) {
          return true;
        }
      }
    }
  }
  return false;
}

// 检查 section 是否满足偏好（不早于 earliest、不晚于 latest、不上周五）
function sectionMeetsPreferences(section, prefs) {
  const earliest = prefs.earliest || "00:00";
  const latest = prefs.latest || "23:59";
  const noFriday = !!prefs.noFriday;

  const earliestMin = timeToMinutes(earliest);
  const latestMin = timeToMinutes(latest);

  for (const t of section.times) {
    if (noFriday && t.day === "Fri") return false;
    const startMin = timeToMinutes(t.start);
    const endMin = timeToMinutes(t.end);
    if (startMin < earliestMin) return false;
    if (endMin > latestMin) return false;
  }
  return true;
}

// 回溯搜索所有合法课表
// courseList: 前端直接传来的课程数组 [{ courseId, name, sections: [...] }, ...]
function generateSchedules(courseList, preferences) {
  const selectedCourses = courseList; // 不再从全局 courses 里筛选

  const results = [];
  const currentSections = [];

  function backtrack(courseIndex) {
    if (courseIndex === selectedCourses.length) {
      results.push([...currentSections]);
      return;
    }

    const course = selectedCourses[courseIndex];

    for (const section of course.sections) {
      if (!sectionMeetsPreferences(section, preferences)) continue;
      if (sectionConflictsWithSchedule(section, currentSections)) continue;

      currentSections.push({
        ...section,
        courseId: course.courseId,
        courseName: course.name
      });
      backtrack(courseIndex + 1);
      currentSections.pop();
    }
  }

  backtrack(0);
  return results;
}

// 获取课程列表（前端用来显示）
app.get("/api/courses", (req, res) => {
  const simplified = courses.map(c => ({
    courseId: c.courseId,
    name: c.name
  }));
  res.json(simplified);
});

// 生成课表组合
app.post("/api/schedules", (req, res) => {
  const { courses: courseList, preferences } = req.body;

  if (!courseList || courseList.length === 0) {
    return res.status(400).json({ error: "No courses provided" });
  }

  const schedules = generateSchedules(courseList, preferences || {});
  res.json({ count: schedules.length, schedules });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});