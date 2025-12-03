const express = require("express");
const router = express.Router();
const scheduleController = require("../controllers/scheduleController");
const { authenticateToken } = require("../middlewares/auth");

// 모든 일정 라우트에는 인증이 필요
router.use(authenticateToken);

router.get("/schedules", scheduleController.getSchedules);
router.get("/schedules/:id", scheduleController.getScheduleById);
router.post("/schedules", scheduleController.createSchedule);
router.put("/schedules/:id", scheduleController.updateSchedule);
router.delete("/schedules/:id", scheduleController.deleteSchedule);

module.exports = router;