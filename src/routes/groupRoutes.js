const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const { authenticateToken } = require("../middlewares/auth");

// 모든 그룹 API는 인증이 필요
router.use(authenticateToken);

// 그룹 관리
router.get("/groups", groupController.getMyGroups);
router.post("/groups", groupController.createGroup);
router.get("/groups/:id", groupController.getGroupById);
router.put("/groups/:id", groupController.updateGroupInfo);
router.delete("/groups/:id", groupController.deleteGroup);

// 그룹 기능
router.post("/groups/join", groupController.joinGroup);
router.patch("/groups/:id/color", groupController.updateGroupColor);
router.post("/groups/:id/leave", groupController.leaveGroup);

// 멤버 관리
router.get("/groups/:id/members", groupController.getGroupMembers);
router.delete("/groups/:groupId/members/:memberId", groupController.kickMember);

module.exports = router;