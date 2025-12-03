// DB 행(snake_case) -> 프론트 객체(camelCase) 변환
exports.rowToSchedule = (row) => {
  return {
    id: row.id,
    userId: row.user_id,
    groupId: row.team_id,
    title: row.title,
    description: row.description,
    category: row.category,
    location: row.location,

    // 일반 일정
    start: row.start_datetime,
    end: row.end_datetime,
    allDay: row.is_all_day === 1,

    // 강의 일정
    daysOfWeek: row.days_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    startRecur: row.start_recur,
    endRecur: row.end_recur,

    // 그룹 일정 색상
    color: row.group_color || (row.category === "lecture" ? "#1976d2" : "#2e7d32"),
    
    // 그룹명 (있는 경우)
    groupName: row.group_name || undefined, 
  };
};