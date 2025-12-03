const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const { isValidId } = require("../utils/validation");
require("dotenv").config();

const saltRounds = 10;

// ID 중복 체크
exports.checkId = async (req, res) => {
  const { id } = req.query;
  // 유효성 검사
  if (!id || id.length > 20) return res.json({ isAvailable: false, message: "20자 이내여야 합니다." });
  if (!isValidId(id)) return res.json({ isAvailable: false, message: "영문과 숫자만 사용 가능합니다." });

  try {
    const exists = await userModel.checkIdExists(id);
    res.json({ isAvailable: !exists });
  } catch (err) {
    console.error(err);
    res.status(500).send("DB Error");
  }
};

// 회원가입
exports.register = async (req, res) => {
  const { id, password, nickname } = req.body;
  
  if (id && id.length > 20) return res.status(400).send("아이디는 20자를 넘을 수 없습니다.");
  if (!isValidId(id)) return res.status(400).send("아이디는 영문과 숫자만 사용할 수 있습니다.");
  if (nickname && nickname.length > 20) return res.status(400).send("닉네임은 20자를 넘을 수 없습니다.");

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await userModel.createUser(id, hashedPassword, nickname);
    console.log("회원가입 성공:", id, nickname);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    if (err.code === "ER_DUP_ENTRY") return res.status(400).send("이미 존재하는 ID입니다.");
    res.status(500).send("회원가입 실패");
  }
};

// 로그인
exports.login = async (req, res) => {
  const { id, password } = req.body;

  if (id && id.length > 20) return res.status(400).send("아이디가 너무 깁니다.");

  try {
    const user = await userModel.findById(id);
    
    // 유저가 없거나 비밀번호 불일치
    if (!user) return res.status(400).send("아이디 또는 비밀번호가 일치하지 않습니다.");
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).send("아이디 또는 비밀번호가 일치하지 않습니다.");

    const token = jwt.sign({ id: user.id, nickname: user.nickname }, process.env.JWT_SECRET);
    res.json({ accessToken: token, nickname: user.nickname });
  } catch (err) {
    console.error(err);
    res.status(500).send("로그인 처리 중 오류 발생");
  }
};

// 내 정보 수정
exports.updateMe = async (req, res) => {
    const userId = req.user.id;
    const { nickname } = req.body;
  
    if (nickname && nickname.length > 20) return res.status(400).send("닉네임은 20자를 넘을 수 없습니다.");
  
    try {
      if (nickname) {
        await userModel.updateNickname(userId, nickname);
      }
      res.sendStatus(200);
    } catch (err) {
      console.error(err);
      res.status(500).send("정보 수정 실패");
    }
  };