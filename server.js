require("dotenv").config();
const express = require("express");
const helmet = require('helmet');
const app = express();
const PORT = process.env.PORT;

// 미들웨어
app.use(helmet());
app.use(express.json());

// 라우터 import
const authRoutes = require("./src/routes/authRoutes");
const scheduleRoutes = require("./src/routes/scheduleRoutes");
const groupRoutes = require("./src/routes/groupRoutes");

// 라우터 등록
app.use("/api", authRoutes); 
app.use("/api", scheduleRoutes);
app.use("/api", groupRoutes);


// 배포용 설정
const path = require('path');

app.use(express.static(path.join(__dirname, 'build')));

// API 요청(/api/...)이 아닌 모든 요청은 리액트(index.html)로 보냄
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


// 서버 실행
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다!`);
});