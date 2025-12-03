const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken } = require("../middlewares/auth");

// 인증이 필요 없는 API
router.get("/users/check-id", authController.checkId);
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);

// 인증이 필요한 API
router.patch("/users/me", authenticateToken, authController.updateMe);

module.exports = router;