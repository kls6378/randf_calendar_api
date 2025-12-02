require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT;

// [미들웨어 설정]
app.use(cors()); // 모든 도메인 요청 허용 (CORS 해결)
app.use(express.json()); // JSON 데이터 파싱 허용


// [라우트 연결]


// [기본 경로 테스트]
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// [서버 실행]
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});