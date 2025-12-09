// src/api.js
import axios from "axios";

const BASE_URL = "https://course-scheduler-bqzd.onrender.com/";

// 调用后端生成课表组合
export async function fetchSchedules(courses, preferences) {
  const res = await axios.post(`${BASE_URL}/api/schedules`, {
    courses,
    preferences,
  });
  return res.data; // { count, schedules }
}