const groupModel = require("../models/groupModel");

// 내 그룹 목록
exports.getMyGroups = async (req, res) => {
  const userId = req.user.id;
  try {
    const groups = await groupModel.findAllByUserId(userId);
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 목록 조회 실패");
  }
};

// 그룹 생성
exports.createGroup = async (req, res) => {
  const userId = req.user.id;
  const { name, description } = req.body;

  if (name && name.length > 20) return res.status(400).send("그룹 이름은 20자를 넘을 수 없습니다.");

  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  try {
    const newTeamId = await groupModel.createTeamWithLeader(name, description, inviteCode, userId);
    console.log(`그룹 생성 완료: ${name} (ID: ${newTeamId})`);
    res.json({ id: newTeamId, inviteCode });
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 생성 실패");
  }
};

// 그룹 상세
exports.getGroupById = async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const group = await groupModel.findByIdAndUser(teamId, userId);
    
    if (!group) return res.status(403).send("접근 권한이 없거나 그룹이 없습니다.");

    // 리더가 아니면 초대코드 가리기
    if (group.role !== "leader") {
      group.invite_code = null;
    }
    group.inviteCode = group.invite_code; // 프론트 호환성

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 상세 조회 실패");
  }
};

// 그룹 참가
exports.joinGroup = async (req, res) => {
  const { inviteCode } = req.body;
  const userId = req.user.id;

  if (!inviteCode || inviteCode.length !== 6) return res.status(400).send("초대 코드는 6자리여야 합니다.");

  try {
    const team = await groupModel.findByInviteCode(inviteCode);
    if (!team) return res.status(404).send("잘못된 코드입니다.");

    const member = await groupModel.findMember(team.id, userId);
    if (member) return res.status(400).send("이미 가입된 그룹입니다.");

    await groupModel.addMember(team.id, userId);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 참가 실패");
  }
};

// 색상 변경
exports.updateGroupColor = async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;
  const { color } = req.body;

  try {
    await groupModel.updateMemberColor(teamId, userId, color);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("색상 변경 실패");
  }
};

// 그룹 나가기
exports.leaveGroup = async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    await groupModel.removeMember(teamId, userId);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 나가기 실패");
  }
};

// 그룹 정보 수정 (리더)
exports.updateGroupInfo = async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;
  const { name, description } = req.body;

  if (name && name.length > 20) return res.status(400).send("그룹 이름은 20자를 넘을 수 없습니다.");

  try {
    const member = await groupModel.findMember(teamId, userId);
    if (!member || member.role !== "leader") return res.status(403).send("권한이 없습니다.");

    await groupModel.updateTeam(teamId, name, description);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 수정 실패");
  }
};

// 그룹 삭제 (리더)
exports.deleteGroup = async (req, res) => {
  const teamId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    const member = await groupModel.findMember(teamId, userId);
    if (!member || member.role !== "leader") return res.status(403).send("권한이 없습니다.");

    await groupModel.deleteTeam(teamId);
    console.log(`그룹 삭제 완료: ${teamId}`);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("그룹 삭제 실패");
  }
};

// 멤버 목록 조회
exports.getGroupMembers = async (req, res) => {
  const teamId = parseInt(req.params.id);
  try {
    const members = await groupModel.findAllMembers(teamId);
    
    // 포맷팅
    const responseData = members.map((row) => ({
      id: row.id,
      userId: row.user_id,
      nickname: row.nickname,
      role: row.role,
    }));

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).send("멤버 조회 실패");
  }
};

// 멤버 강퇴 (리더)
exports.kickMember = async (req, res) => {
  const teamId = parseInt(req.params.groupId);
  const targetMemberId = parseInt(req.params.memberId);
  const userId = req.user.id;

  try {
    const member = await groupModel.findMember(teamId, userId);
    if (!member || member.role !== "leader") return res.status(403).send("권한이 없습니다.");

    await groupModel.removeMemberById(targetMemberId);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("멤버 강퇴 실패");
  }
};