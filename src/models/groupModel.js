const pool = require("../config/database");

// 내 그룹 목록 조회
exports.findAllByUserId = async (userId) => {
  const query = `
    SELECT t.id, t.name, t.description as \`desc\`, t.invite_code, 
           tm.role, tm.color,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as memberCount
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    WHERE tm.user_id = ?
  `;
  const [rows] = await pool.query(query, [userId]);
  return rows;
};

// 그룹 상세 조회
exports.findByIdAndUser = async (teamId, userId) => {
  const query = `
    SELECT t.id, t.name, t.description as \`desc\`, t.invite_code, 
           tm.role, tm.color,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as memberCount
    FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE t.id = ? AND tm.user_id = ?
  `;
  const [rows] = await pool.query(query, [teamId, userId]);
  return rows[0];
};

// 그룹 생성 (트랜잭션)
exports.createTeamWithLeader = async (name, description, inviteCode, userId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction(); // 트랜잭션 시작

    // 1. 팀 생성
    const [result] = await conn.query(
      "INSERT INTO teams (name, description, invite_code) VALUES (?, ?, ?)",
      [name, description, inviteCode]
    );
    const newTeamId = result.insertId;

    // 2. 리더 추가
    await conn.query(
      "INSERT INTO team_members (team_id, user_id, role, color) VALUES (?, ?, ?, ?)",
      [newTeamId, userId, "leader", "#ed6c02"]
    );

    await conn.commit(); // 성공 확정
    return newTeamId;
  } catch (err) {
    await conn.rollback(); // 실패 시 되돌리기
    throw err;
  } finally {
    conn.release();
  }
};

// 초대 코드로 팀 찾기
exports.findByInviteCode = async (inviteCode) => {
  const [rows] = await pool.query("SELECT id FROM teams WHERE invite_code = ?", [inviteCode]);
  return rows[0];
};

// 멤버 확인
exports.findMember = async (teamId, userId) => {
  const [rows] = await pool.query(
    "SELECT * FROM team_members WHERE team_id = ? AND user_id = ?",
    [teamId, userId]
  );
  return rows[0];
};

// 멤버 추가
exports.addMember = async (teamId, userId) => {
  await pool.query(
    "INSERT INTO team_members (team_id, user_id, role, color) VALUES (?, ?, ?, ?)",
    [teamId, userId, "member", "#ed6c02"]
  );
};

// 색상 변경
exports.updateMemberColor = async (teamId, userId, color) => {
  await pool.query(
    "UPDATE team_members SET color = ? WHERE team_id = ? AND user_id = ?",
    [color, teamId, userId]
  );
};

// 멤버 삭제 (나가기)
exports.removeMember = async (teamId, userId) => {
  await pool.query("DELETE FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId]);
};

// 멤버 삭제 (강퇴용)
exports.removeMemberById = async (memberId) => {
    await pool.query("DELETE FROM team_members WHERE id = ?", [memberId]);
};

// 팀 정보 수정
exports.updateTeam = async (teamId, name, description) => {
  if (name) await pool.query("UPDATE teams SET name = ? WHERE id = ?", [name, teamId]);
  if (description !== undefined) await pool.query("UPDATE teams SET description = ? WHERE id = ?", [description, teamId]);
};

// 팀 삭제
exports.deleteTeam = async (teamId) => {
  await pool.query("DELETE FROM teams WHERE id = ?", [teamId]);
};

// 팀 멤버 목록 조회
exports.findAllMembers = async (teamId) => {
  const query = `
    SELECT tm.id, tm.user_id, tm.role, tm.color,
           u.nickname, u.id as user_real_id
    FROM team_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ?
  `;
  const [rows] = await pool.query(query, [teamId]);
  return rows;
};