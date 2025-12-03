const pool = require("../config/database");

// 전체 일정 조회 (내 개인 일정 + 내 그룹 일정)
exports.findAll = async (userId) => {
  const query = `
    SELECT s.*, tm.color as group_color
    FROM schedules s
    LEFT JOIN team_members tm ON s.team_id = tm.team_id AND tm.user_id = ?
    WHERE s.user_id = ? 
       OR (s.category = 'group' AND s.team_id IN (
           SELECT team_id FROM team_members WHERE user_id = ?
       ))
  `;
  const [rows] = await pool.query(query, [userId, userId, userId]);
  return rows;
};

// 상세 일정 조회 (+ 그룹 정보)
exports.findByIdWithGroup = async (scheduleId, userId) => {
  const query = `
    SELECT s.*, t.name as group_name, tm.color as group_color
    FROM schedules s
    LEFT JOIN teams t ON s.team_id = t.id
    LEFT JOIN team_members tm ON s.team_id = tm.team_id AND tm.user_id = ?
    WHERE s.id = ?
  `;
  const [rows] = await pool.query(query, [userId, scheduleId]);
  return rows[0];
};

// 단순 조회 (권한 체크용)
exports.findById = async (scheduleId) => {
    const [rows] = await pool.query("SELECT * FROM schedules WHERE id = ?", [scheduleId]);
    return rows[0];
};

// 일정 생성
exports.create = async (params) => {
  const query = `
    INSERT INTO schedules 
    (user_id, team_id, title, description, category, location, 
     start_datetime, end_datetime, is_all_day, 
     days_of_week, start_time, end_time, start_recur, end_recur)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await pool.query(query, params);
};

// 일정 수정
exports.update = async (params) => {
  const query = `
    UPDATE schedules SET 
    title=?, description=?, category=?, location=?,
    start_datetime=?, end_datetime=?, is_all_day=?,
    days_of_week=?, start_time=?, end_time=?, start_recur=?, end_recur=?,
    team_id=?
    WHERE id=?
  `;
  await pool.query(query, params);
};

// 일정 삭제
exports.delete = async (id) => {
  await pool.query("DELETE FROM schedules WHERE id = ?", [id]);
};