const mysql = require('mysql2/promise');
require('dotenv').config();

// MySQL 연결 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,      // MySQL 유저명
  password: process.env.DB_PASSWORD, // MySQL 비밀번호
  database: process.env.DB_NAME, // DB 이름
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // 날짜를 문자열로 가져옴 (JS Date 객체 자동변환 방지)
});

// 연결 테스트
pool.getConnection()
  .then(conn => {
    console.log('MySQL 데이터베이스 연결 성공!');
    conn.release();
  })
  .catch(err => {
    console.error('MySQL 연결 실패:', err);
  });

module.exports = pool;