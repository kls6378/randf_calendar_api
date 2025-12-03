const pool = require("../config/database"); 

// ID로 유저 찾기
exports.findById = async (id) => {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0];
};

// ID 중복 확인 (존재 여부 boolean 반환)
exports.checkIdExists = async (id) => {
  const [rows] = await pool.query("SELECT count(*) as count FROM users WHERE id = ?", [id]);
  return rows[0].count > 0;
};

// 회원가입 (유저 생성)
exports.createUser = async (id, hashedPassword, nickname) => {
  await pool.query(
    "INSERT INTO users (id, password, nickname) VALUES (?, ?, ?)",
    [id, hashedPassword, nickname]
  );
};

// 닉네임 수정
exports.updateNickname = async (userId, nickname) => {
  await pool.query("UPDATE users SET nickname = ? WHERE id = ?", [nickname, userId]);
};