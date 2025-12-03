const scheduleModel = require("../models/scheduleModel");
const { rowToSchedule } = require("../utils/formatters");

// 일정 조회
exports.getSchedules = async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await scheduleModel.findAll(userId);
    const responseData = rows.map(rowToSchedule);
    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).send("일정 조회 실패");
  }
};

// 일정 상세 조회
exports.getScheduleById = async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const row = await scheduleModel.findByIdWithGroup(id, userId);
    if (!row) return res.status(404).send("일정을 찾을 수 없습니다.");

    // 권한 체크
    if (row.category === "group" && !row.group_color && row.user_id !== userId) {
      return res.status(403).send("접근 권한이 없습니다.");
    }
    if (row.category !== "group" && row.user_id !== userId) {
      return res.status(403).send("접근 권한이 없습니다.");
    }

    res.json(rowToSchedule(row));
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
};

// 일정 생성
exports.createSchedule = async (req, res) => {
  const userId = req.user.id;
  const body = req.body;

  // 간단 유효성 검사 (상세 검사는 필요 시 추가)
  if (body.title && body.title.length > 20) return res.status(400).send("제목 20자 초과");

  try {
    const startDt = body.start ? new Date(body.start) : null;
    const endDt = body.end ? new Date(body.end) : null;
    
    const params = [
      userId,
      body.groupId || null,
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
    ];

    await scheduleModel.create(params);
    console.log("일정 생성 완료:", body.title);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("일정 생성 실패");
  }
};

// 일정 수정
exports.updateSchedule = async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;
  const body = req.body;

  try {
    // 권한 확인
    const schedule = await scheduleModel.findById(id);
    if (!schedule) return res.status(404).send("일정 없음");
    if (schedule.user_id !== userId) return res.status(403).send("권한 없음");

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
      id
    ];

    await scheduleModel.update(params);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("일정 수정 실패");
  }
};

// 일정 삭제
exports.deleteSchedule = async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const schedule = await scheduleModel.findById(id);
    if (!schedule) return res.status(404).send("일정 없음");
    if (schedule.user_id !== userId) return res.status(403).send("권한 없음");

    await scheduleModel.delete(id);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("일정 삭제 실패");
  }
};