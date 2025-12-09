// backend/data.js

// 时间用 "HH:MM" 字符串，方便后面转换
const courses = [
  {
    courseId: "MATH340",
    name: "Elementary Matrix and Linear Algebra",
    sections: [
      {
        sectionId: "MATH340-LEC-001",
        times: [
          { day: "Mon", start: "09:55", end: "10:45" },
          { day: "Wed", start: "09:55", end: "10:45" },
          { day: "Fri", start: "09:55", end: "10:45" }
        ]
      },
      {
        sectionId: "MATH340-LEC-002",
        times: [
          { day: "Tue", start: "13:00", end: "14:15" },
          { day: "Thu", start: "13:00", end: "14:15" }
        ]
      }
    ]
  },
  {
    courseId: "CS400",
    name: "Programming III",
    sections: [
      {
        sectionId: "CS400-LEC-001",
        times: [
          { day: "Mon", start: "11:00", end: "12:15" },
          { day: "Wed", start: "11:00", end: "12:15" }
        ]
      },
      {
        sectionId: "CS400-LEC-002",
        times: [
          { day: "Tue", start: "15:00", end: "16:15" },
          { day: "Thu", start: "15:00", end: "16:15" }
        ]
      }
    ]
  },
  {
    courseId: "STAT324",
    name: "Introductory Probability",
    sections: [
      {
        sectionId: "STAT324-LEC-001",
        times: [
          { day: "Mon", start: "08:00", end: "09:15" },
          { day: "Wed", start: "08:00", end: "09:15" }
        ]
      },
      {
        sectionId: "STAT324-LEC-002",
        times: [
          { day: "Tue", start: "10:00", end: "11:15" },
          { day: "Thu", start: "10:00", end: "11:15" }
        ]
      }
    ]
  }
];

module.exports = { courses };