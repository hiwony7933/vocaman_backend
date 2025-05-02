const express = require("express");
const dotenv = require("dotenv");
const mariadb = require("mariadb"); // MariaDB 드라이버
const path = require("path"); // 추가
const swaggerJsdoc = require("swagger-jsdoc"); // 추가
const swaggerUi = require("swagger-ui-express"); // 추가

// .env 파일 로드
dotenv.config();

// Express 앱 생성
const app = express();
const PORT = process.env.PORT || 3000; // .env 파일의 PORT 또는 기본값 3000

// JSON 요청 본문 파싱 설정
app.use(express.json());
// URL-encoded 요청 본문 파싱 설정
app.use(express.urlencoded({ extended: true }));

// 정적 파일 서빙 설정 (예: public 디렉토리)
app.use(express.static(path.join(__dirname, "public"))); // 추가
// 특정 경로(예: /audio)에 대한 정적 파일 서빙
app.use("/api/v2/audio", express.static(path.join(__dirname, "public/audio"))); // 추가

// --- 데이터베이스 설정 및 연결 풀 생성 ---
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 5, // 동시에 유지할 수 있는 최대 연결 수 (조정 가능)
  // 타임존 관련 설정 추가 (선택 사항)
  timezone: "Asia/Seoul", // DB 연결 시 타임존 설정
};

const pool = mariadb.createPool(dbConfig);

// 데이터베이스 연결 풀 export 추가
module.exports.pool = pool; // 추가

// --- 라우터 임포트 ---
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes"); // 추가
const datasetRoutes = require("./routes/datasetRoutes"); // 추가
const gameRoutes = require("./routes/gameRoutes"); // 추가
const homeworkRoutes = require("./routes/homeworkRoutes"); // 추가
const notificationRoutes = require("./routes/notificationRoutes"); // 추가
const contentRoutes = require("./routes/contentRoutes"); // 추가

// --- Swagger 설정 ---
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Vocaman API",
      version: "2.0.0",
      description: "Vocaman v2.0 Backend API Documentation",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`, // 개발 서버 주소 (환경에 맞게 변경)
        description: "Development server",
      },
      // TODO: 실제 배포 서버 주소 추가
    ],
    // JWT 인증 설정을 위한 components 추가
    components: {
      securitySchemes: {
        bearerAuth: {
          // 이름은 자유롭게 지정 가능 (예: bearerAuth)
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT", // Optional
        },
      },
    },
    security: [
      {
        bearerAuth: [], // 위에서 정의한 securityScheme 이름 사용
      },
    ],
  },
  // JSDoc 주석이 포함된 파일 경로 (라우터 파일들)
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// --- API 라우트 설정 ---

// Swagger UI 라우트
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // 추가

// 인증 관련 라우트 등록
app.use("/api/v2/auth", authRoutes);
// 사용자 관련 라우트 등록
app.use("/api/v2/users", userRoutes); // 추가
// 데이터셋 관련 라우트 등록
app.use("/api/v2/datasets", datasetRoutes); // 추가
// 게임 관련 라우트 등록
app.use("/api/v2/game", gameRoutes); // 추가
// 숙제 관련 라우트 등록
app.use("/api/v2/homework", homeworkRoutes); // 추가
// 알림 관련 라우트 등록
app.use("/api/v2/notifications", notificationRoutes); // 추가
app.use("/api/v2", contentRoutes); // 변경: /api/v2 접두사 사용 (/concepts, /terms, /audio 경로)

// 서버 상태 및 DB 연결 확인용 헬스 체크 엔드포인트
app.get("/api/health", async (req, res) => {
  let conn;
  try {
    // 연결 풀에서 연결 가져오기 시도
    conn = await pool.getConnection();
    // 간단한 쿼리 실행으로 DB 연결 확인
    await conn.query("SELECT 1");
    res.status(200).json({
      status: "OK",
      message: "서버 정상 동작 및 데이터베이스 연결 성공",
      dbConnection: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("헬스 체크 중 오류 발생:", error);
    res.status(503).json({
      // 503 Service Unavailable
      status: "Error",
      message: "서버는 동작 중이나 데이터베이스 연결 실패",
      dbConnection: false,
      error: error.message, // 실제 운영 환경에서는 상세 오류 메시지 노출 주의
      timestamp: new Date().toISOString(),
    });
  } finally {
    // 연결 반드시 반환
    if (conn) {
      conn.release();
    }
  }
});

// 기본 라우트
app.get("/", (req, res) => {
  res.json({ message: "Vocaman 백엔드 서버에 오신 것을 환영합니다!" });
});

// --- 서버 시작 ---
app.listen(PORT, async () => {
  console.log(`서버가 포트 ${PORT} 에서 실행 중입니다.`);
  // 서버 시작 시 데이터베이스 연결 테스트 (선택 사항)
  let conn;
  try {
    conn = await pool.getConnection();
    console.log(`데이터베이스 '${dbConfig.database}' 연결 성공!`);
  } catch (err) {
    console.error("서버 시작 중 데이터베이스 연결 실패:", err);
    // 필요하다면 여기서 서버를 종료 처리할 수도 있습니다.
    // process.exit(1);
  } finally {
    if (conn) conn.release();
  }
});
