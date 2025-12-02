require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
const pool = require("./database");
const bcrypt = require("bcrypt");
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT;
const SECRET_KEY = process.env.JWT_SECRET;
const saltRounds = 10; // bcrypt 암호화 복잡도 (보통 10 사용)
// ID 유효성 검사 함수 (영문 대소문자 + 숫자만 허용)
// ^ : 시작
// [a-zA-Z0-9] : 영문자 또는 숫자
// + : 1글자 이상
// $ : 끝
const isValidId = (id) => /^[a-zA-Z0-9]+$/.test(id);

app.use(helmet());
app.use(express.json());

// ==========================================
// 인증 미들웨어
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ==========================================
// 1. 인증 & 유저 API
// ==========================================

// ID 중복 체크
app.get("/api/users/check-id", async (req, res) => {
  const { id } = req.query;
  // 유효성 검사. 길이 체크 + 한글/특수문자 체크
  if (!id || id.length > 20)
    return res.json({ isAvailable: false, message: "20자 이내여야 합니다." });
  if (!isValidId(id)) {
    return res.json({
      isAvailable: false,
      message: "영문과 숫자만 사용 가능합니다.",
    });
  }
  try {
    // SQL: users 테이블에서 해당 id 개수 세기
    const [rows] = await pool.query(
      "SELECT count(*) as count FROM users WHERE id = ?",
      [id]
    );
    const exists = rows[0].count > 0;
    res.json({ isAvailable: !exists });
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
});

// 회원가입
app.post("/api/auth/register", async (req, res) => {
  const { id, password, nickname } = req.body;
  // 유효성 검사
  if (id && id.length > 20)
    return res.status(400).send("아이디는 20자를 넘을 수 없습니다.");
  if (!isValidId(id))
    return res.status(400).send("아이디는 영문과 숫자만 사용할 수 있습니다."); // 한글 차단
  if (nickname && nickname.length > 20)
    return res.status(400).send("닉네임은 20자를 넘을 수 없습니다.");
  try {
    // 1. 비밀번호 암호화 (Hashing)
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 2. 암호화된 비밀번호를 DB에 저장
    await pool.query(
      "INSERT INTO users (id, password, nickname) VALUES (?, ?, ?)",
      [id, hashedPassword, nickname]
    );

    console.log("회원가입 성공:", id, nickname);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).send("이미 존재하는 ID입니다.");
    }
    res.status(500).send("회원가입 실패");
  }
});

// 로그인
app.post("/api/auth/login", async (req, res) => {
  const { id, password } = req.body;

  // 유효성 검사
  if (id && id.length > 20)
    return res.status(400).send("아이디가 너무 깁니다.");

  try {
    // 1. ID로 유저 정보 조회
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);

    // ID가 없으면 실패
    if (rows.length === 0) {
      return res.status(400).send("아이디 또는 비밀번호가 일치하지 않습니다.");
    }

    const user = rows[0];

    // 2. 비밀번호 비교 (bcrypt가 해줌)
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).send("아이디 또는 비밀번호가 일치하지 않습니다.");
    }

    // 3. 성공 시 토큰 발급
    const token = jwt.sign(
      { id: user.id, nickname: user.nickname },
      SECRET_KEY
    );
    res.json({ accessToken: token, nickname: user.nickname });
  } catch (err) {
    console.error(err);
    res.status(500).send("로그인 처리 중 오류 발생");
  }
});

// 내 정보 수정
app.patch("/api/users/me", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { nickname } = req.body;

  // 유효성 검사
  if (nickname && nickname.length > 20)
    return res.status(400).send("닉네임은 20자를 넘을 수 없습니다.");

  try {
    if (nickname) {
      // SQL: 닉네임 업데이트
      await pool.query("UPDATE users SET nickname = ? WHERE id = ?", [
        nickname,
        userId,
      ]);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("정보 수정 실패");
  }
});

// ==========================================
// 2. 캘린더 일정 API (Prefix: /api)
// ==========================================

// [헬퍼 함수] DB 행(snake_case)을 프론트엔드 객체(camelCase)로 변환
const rowToSchedule = (row) => {
  return {
    id: row.id,
    userId: row.user_id,
    groupId: row.team_id, // DB는 team_id, 프론트는 groupId
    title: row.title,
    description: row.description,
    category: row.category,
    location: row.location,

    // 일반 일정
    start: row.start_datetime, // 프론트: start, DB: start_datetime
    end: row.end_datetime,
    allDay: row.is_all_day === 1, // DB: 0/1 -> 프론트: boolean

    // 강의 일정
    daysOfWeek: row.days_of_week, // JSON 타입은 라이브러리가 알아서 배열로 줌
    startTime: row.start_time,
    endTime: row.end_time,
    startRecur: row.start_recur,
    endRecur: row.end_recur,

    // 그룹 일정 색상 (JOIN으로 가져온 경우)
    color:
      row.group_color || (row.category === "lecture" ? "#1976d2" : "#2e7d32"),
  };
};

// 일정 조회
app.get("/api/schedules", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // SQL: 내 일정 OR (내가 속한 그룹의 일정 + 내 그룹 색상)
    // schedules 테이블(s)과 team_members 테이블(tm)을 조인
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

    // 변환 후 전송
    const responseData = rows.map(rowToSchedule);
    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).send("일정 조회 실패");
  }
});

// 일정 상세 조회 (단건)
app.get("/api/schedules/:id", authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    // 1. 일정 정보 + (그룹 일정인 경우) 그룹 이름 + 내 설정 색상 조회
    const query = `
      SELECT s.*, t.name as group_name, tm.color as group_color
      FROM schedules s
      LEFT JOIN teams t ON s.team_id = t.id
      LEFT JOIN team_members tm ON s.team_id = tm.team_id AND tm.user_id = ?
      WHERE s.id = ?
    `;

    const [rows] = await pool.query(query, [userId, id]);
    if (rows.length === 0)
      return res.status(404).send("일정을 찾을 수 없습니다.");

    const row = rows[0];

    // 2. 권한 확인 (작성자이거나, 해당 그룹의 멤버여야 함)
    // (위 쿼리에서 team_members를 조인했지만, 멤버가 아니면 group_color가 null일 뿐 조회는 됨.
    //  확실한 보안을 위해 내 그룹인지 체크 로직 추가)
    if (
      row.category === "group" &&
      !row.group_color &&
      row.user_id !== userId
    ) {
      // 그룹 일정인데 내 멤버십 정보(색상 등)가 없다? -> 남의 그룹임
      return res.status(403).send("접근 권한이 없습니다.");
    }
    if (row.category !== "group" && row.user_id !== userId) {
      return res.status(403).send("접근 권한이 없습니다.");
    }

    const responseData = rowToSchedule(row);
    if (row.group_name) responseData.groupName = row.group_name; // 그룹명 추가

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
});

// 일정 생성
app.post("/api/schedules", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const {
    title,
    description,
    category,
    location,
    start,
    end,
    allDay, // 일반 일정 (start/end ISO string)
    daysOfWeek,
    startTime,
    endTime,
    startRecur,
    endRecur, // 강의 일정
    groupId, // 그룹 ID
  } = req.body;

  // 유효성 검사
  if (title && title.length > 20) {
    return res.status(400).send("일정 제목은 20자를 넘을 수 없습니다.");
  }
  // 강의실(20자), 일반 장소(50자) 구분 체크
  if (location) {
    if (category === "lecture" && location.length > 20) {
      return res.status(400).send("강의실 정보는 20자를 넘을 수 없습니다.");
    }
    if (location.length > 50) {
      return res.status(400).send("장소는 50자를 넘을 수 없습니다.");
    }
  }

  try {
    // 날짜 값 정리 (빈 문자열이나 undefined는 NULL로 처리)
    const startDt = start ? new Date(start) : null;
    const endDt = end ? new Date(end) : null;
    const isAllDay = allDay ? 1 : 0;

    // team_id 변환
    const teamId = groupId || null;

    const query = `
      INSERT INTO schedules 
      (user_id, team_id, title, description, category, location, 
       start_datetime, end_datetime, is_all_day, 
       days_of_week, start_time, end_time, start_recur, end_recur)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      userId,
      teamId,
      title,
      description,
      category,
      location,
      startDt,
      endDt,
      isAllDay,
      JSON.stringify(daysOfWeek),
      startTime,
      endTime,
      startRecur,
      endRecur,
    ];

    await pool.query(query, params);
    console.log("일정 DB 저장 완료:", title);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("일정 생성 실패");
  }
});

// 일정 수정
app.put("/api/schedules/:id", authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;
  const body = req.body;

  // 유효성 검사
  if (title && title.length > 20) return res.status(400).send("제목 20자 초과");
  if (location) {
    if (category === "lecture" && location.length > 20)
      return res.status(400).send("강의실 20자 초과");
    if (location.length > 50) return res.status(400).send("장소 50자 초과");
  }

  try {
    // 본인 일정인지 확인 (간단하게 user_id 체크)
    // (엄밀히 하려면 그룹 일정의 경우 리더 권한 체크 등을 해야 하지만, 일단 작성자 기준)
    const [check] = await pool.query(
      "SELECT user_id FROM schedules WHERE id = ?",
      [id]
    );
    if (check.length === 0) return res.status(404).send("일정 없음");
    if (check[0].user_id !== userId) return res.status(403).send("권한 없음");

    // 업데이트 쿼리 구성 (동적 업데이트)
    // 간단하게 하기 위해 전체 필드를 덮어쓰는 방식 사용
    const query = `
      UPDATE schedules SET 
      title=?, description=?, category=?, location=?,
      start_datetime=?, end_datetime=?, is_all_day=?,
      days_of_week=?, start_time=?, end_time=?, start_recur=?, end_recur=?,
      team_id=?
      WHERE id=?
    `;

    const startDt = body.start ? new Date(body.start) : null;
    const endDt = body.end ? new Date(body.end) : null;

    const params = [
      body.title,
      body.description,
      body.category,
      body.location,
      startDt,
      endDt,
      body.allDay ? 1 : 0,
      JSON.stringify(body.daysOfWeek),
      body.startTime,
      body.endTime,
      body.startRecur,
      body.endRecur,
      body.groupId || null,
      id,
    ];

    await pool.query(query, params);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("일정 수정 실패");
  }
});

// 일정 삭제
app.delete("/api/schedules/:id", authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    // 본인 확인
    const [check] = await pool.query(
      "SELECT user_id FROM schedules WHERE id = ?",
      [id]
    );
    if (check.length === 0) return res.status(404).send("일정 없음");
    if (check[0].user_id !== userId) return res.status(403).send("권한 없음");

    await pool.query("DELETE FROM schedules WHERE id = ?", [id]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("일정 삭제 실패");
  }
});

// ==========================================
// 3. 그룹 API (Prefix: /api)
// ==========================================

// 내 그룹 목록
app.get("/api/groups", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // SQL: 내가 가입한 팀 정보 + 멤버 수 카운트
    const query = `
      SELECT t.id, t.name, t.description as \`desc\`, t.invite_code, 
             tm.role, tm.color,
             (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as memberCount
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = ?
    `;

    const [rows] = await pool.query(query, [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 목록 조회 실패");
  }
});

// 그룹 생성
app.post("/api/groups", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { name, description } = req.body;

  // 유효성 검사
  if (name && name.length > 20)
    return res.status(400).send("그룹 이름은 20자를 넘을 수 없습니다.");

  // 초대 코드 생성 (랜덤 6자리)
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction(); // 트랜잭션 시작 (두 개 다 성공해야 함)

    // 1. teams 테이블에 그룹 생성
    const [result] = await conn.query(
      "INSERT INTO teams (name, description, invite_code) VALUES (?, ?, ?)",
      [name, description, inviteCode]
    );
    const newTeamId = result.insertId;

    // 2. team_members 테이블에 리더(나) 추가
    await conn.query(
      "INSERT INTO team_members (team_id, user_id, role, color) VALUES (?, ?, ?, ?)",
      [newTeamId, userId, "leader", "#ed6c02"]
    );

    await conn.commit(); // 저장 확정
    console.log(`그룹 생성 완료: ${name} (ID: ${newTeamId})`);

    res.json({ id: newTeamId, inviteCode });
  } catch (err) {
    await conn.rollback(); // 실패 시 되돌리기
    console.error(err);
    res.status(500).send("그룹 생성 실패");
  } finally {
    conn.release();
  }
});

// 그룹 상세
app.get("/api/groups/:id", authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    // 그룹 정보 + 내 역할/색상 조회
    const query = `
      SELECT t.id, t.name, t.description as \`desc\`, t.invite_code, 
             tm.role, tm.color,
             (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as memberCount
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE t.id = ? AND tm.user_id = ?
    `;

    const [rows] = await pool.query(query, [teamId, userId]);

    if (rows.length === 0)
      return res.status(403).send("접근 권한이 없거나 그룹이 없습니다.");

    const group = rows[0];
    // 리더가 아니면 초대코드는 가리기
    if (group.role !== "leader") {
      group.invite_code = null;
    }

    // 프론트엔드 호환성 (invite_code -> inviteCode)
    group.inviteCode = group.invite_code;

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 상세 조회 실패");
  }
});

// 그룹 참가 (초대 코드)
app.post("/api/groups/join", authenticateToken, async (req, res) => {
  const { inviteCode } = req.body;
  const userId = req.user.id;

  // 유효성 검사
  // 초대코드는 정확히 6자리여야 함 (DB상 VARCHAR(6))
  if (!inviteCode || inviteCode.length !== 6) {
    return res.status(400).send("초대 코드는 6자리여야 합니다.");
  }

  try {
    // 1. 초대 코드로 팀 찾기
    const [teams] = await pool.query(
      "SELECT id FROM teams WHERE invite_code = ?",
      [inviteCode]
    );
    if (teams.length === 0) return res.status(404).send("잘못된 코드입니다.");

    const teamId = teams[0].id;

    // 2. 이미 가입했는지 확인
    const [members] = await pool.query(
      "SELECT * FROM team_members WHERE team_id = ? AND user_id = ?",
      [teamId, userId]
    );
    if (members.length > 0)
      return res.status(400).send("이미 가입된 그룹입니다.");

    // 3. 멤버 추가
    await pool.query(
      "INSERT INTO team_members (team_id, user_id, role, color) VALUES (?, ?, ?, ?)",
      [teamId, userId, "member", "#ed6c02"]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 참가 실패");
  }
});

// 그룹 색상 변경
app.patch("/api/groups/:id/color", authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;
  const { color } = req.body;

  try {
    await pool.query(
      "UPDATE team_members SET color = ? WHERE team_id = ? AND user_id = ?",
      [color, teamId, userId]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("색상 변경 실패");
  }
});

// 그룹 나가기
app.post("/api/groups/:id/leave", authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    await pool.query(
      "DELETE FROM team_members WHERE team_id = ? AND user_id = ?",
      [teamId, userId]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 나가기 실패");
  }
});

// 그룹 정보 수정 (리더만)
app.put("/api/groups/:id", authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;
  const { name, description } = req.body;

  // 유효성 검사
  if (name && name.length > 20)
    return res.status(400).send("그룹 이름은 20자를 넘을 수 없습니다.");

  try {
    // 리더 권한 확인
    const [check] = await pool.query(
      "SELECT role FROM team_members WHERE team_id = ? AND user_id = ?",
      [teamId, userId]
    );
    if (check.length === 0 || check[0].role !== "leader") {
      return res.status(403).send("권한이 없습니다.");
    }

    // 업데이트 (동적 쿼리 대신 간단하게 구현)
    if (name)
      await pool.query("UPDATE teams SET name = ? WHERE id = ?", [
        name,
        teamId,
      ]);
    if (description !== undefined)
      await pool.query("UPDATE teams SET description = ? WHERE id = ?", [
        description,
        teamId,
      ]);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 수정 실패");
  }
});

// 그룹 삭제 (리더만)
app.delete("/api/groups/:id", authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    // 리더 권한 확인
    const [check] = await pool.query(
      "SELECT role FROM team_members WHERE team_id = ? AND user_id = ?",
      [teamId, userId]
    );
    if (check.length === 0 || check[0].role !== "leader") {
      return res.status(403).send("권한이 없습니다.");
    }

    // 그룹 삭제 (DB의 ON DELETE CASCADE 설정 덕분에 멤버/일정도 자동 삭제됨)
    await pool.query("DELETE FROM teams WHERE id = ?", [teamId]);
    console.log(`그룹 삭제 완료: ${teamId}`);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 삭제 실패");
  }
});

// ==========================================
// 4. 멤버 관리 API
// ==========================================

// 멤버 목록 조회
app.get("/api/groups/:id/members", authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.id);

  try {
    const query = `
      SELECT tm.id, tm.user_id, tm.role, tm.color,
             u.nickname, u.id as user_real_id
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
    `;
    const [rows] = await pool.query(query, [teamId]);

    // 포맷팅
    const members = rows.map((row) => ({
      id: row.id, // team_members의 PK (강퇴할 때 필요)
      userId: row.user_id,
      nickname: row.nickname,
      role: row.role,
    }));

    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).send("멤버 조회 실패");
  }
});

// 멤버 강퇴 (리더만)
app.delete(
  "/api/groups/:groupId/members/:memberId",
  authenticateToken,
  async (req, res) => {
    const teamId = parseInt(req.params.groupId);
    const targetMemberId = parseInt(req.params.memberId); // team_members 테이블의 PK
    const userId = req.user.id;

    try {
      // 리더 권한 확인
      const [check] = await pool.query(
        "SELECT role FROM team_members WHERE team_id = ? AND user_id = ?",
        [teamId, userId]
      );
      if (check.length === 0 || check[0].role !== "leader") {
        return res.status(403).send("권한이 없습니다.");
      }

      // 강퇴 (team_members 테이블에서 삭제)
      await pool.query("DELETE FROM team_members WHERE id = ?", [
        targetMemberId,
      ]);
      res.sendStatus(200);
    } catch (err) {
      console.error(err);
      res.status(500).send("멤버 강퇴 실패");
    }
  }
);

// ==========================================
// 배포용 설정 (React 정적 파일 서빙)
// ==========================================

// app.use(express.static(path.join(__dirname, '../randf_calendar_pwa/build')));

// // API 요청이 아닌 모든 요청은 리액트 index.html로
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../randf_calendar_pwa/build/index.html'));
// });

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다!`);
});
