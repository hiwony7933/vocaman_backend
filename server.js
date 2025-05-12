// server.js - 보카맨 백엔드 서버 메인 파일

// --- 필수 모듈 임포트 ---
const express = require("express");
const dotenv = require("dotenv");
const mariadb = require("mariadb"); // MariaDB 데이터베이스 드라이버
const path = require("path"); // 파일 경로 관련 모듈
const swaggerJsdoc = require("swagger-jsdoc"); // Swagger JSDoc 생성기
const swaggerUi = require("swagger-ui-express"); // Swagger UI 미들웨어

// --- .env 파일 로드 ---
// 애플리케이션 설정 및 민감한 정보를 .env 파일에서 로드합니다.
// 이 호출은 process.env를 사용하기 전에 가장 먼저 이루어져야 합니다.
dotenv.config();

// --- Express 앱 생성 및 기본 설정 ---
const app = express();
// 컨테이너 내부에서 사용할 포트 번호 (PORT 환경 변수 또는 기본값 3000)
const APP_INTERNAL_PORT = process.env.PORT || 3000;
// NAS에서 외부로 노출시킬 포트 번호 (Swagger UI에서 API 요청 시 사용)
const NAS_EXTERNAL_PORT = 8080; // 이 포트 번호는 NAS Docker 포트 매핑과 일치해야 합니다.

// 요청 본문(body)을 JSON 형태로 파싱하기 위한 미들웨어
app.use(express.json());
// URL-encoded 형태의 요청 본문 파싱을 위한 미들웨어 (form 데이터 처리 등)
app.use(express.urlencoded({ extended: true }));

// --- 정적 파일 서빙 설정 (선택 사항) ---
// 'public' 폴더에 있는 정적 파일들(예: 이미지, CSS, 프론트엔드 빌드 파일 등)을 제공할 수 있습니다.
app.use(express.static(path.join(__dirname, "public")));
// 특정 경로(예: /audio)에 대한 정적 파일 서빙 (오디오 힌트 파일 등)
app.use("/api/v2/audio", express.static(path.join(__dirname, "public/audio")));

// --- 데이터베이스 설정 및 연결 풀 생성 ---
const dbConfig = {
  host: process.env.DB_HOST, // .env 파일에서 DB 호스트 주소 가져오기
  port: process.env.DB_PORT, // .env 파일에서 DB 포트 번호 가져오기
  user: process.env.DB_USER, // .env 파일에서 DB 사용자 이름 가져오기
  password: process.env.DB_PASSWORD, // .env 파일에서 DB 비밀번호 가져오기
  database: process.env.DB_DATABASE, // .env 파일에서 DB 이름 가져오기
  connectionLimit: 5, // 동시에 유지할 수 있는 최대 연결 수
  timezone: "Asia/Seoul", // DB 연결 시 사용할 타임존
  // 연결 타임아웃 설정 (필요시)
  // connectTimeout: 20000, // 20초
  // acquireTimeout: 20000, // 20초
};

// MariaDB 연결 풀 생성 (여러 요청을 효율적으로 처리)
const pool = mariadb.createPool(dbConfig);

// 데이터베이스 연결 풀을 다른 모듈에서 사용할 수 있도록 export (예: 모델 파일)
// module.exports.pool = pool; // 또는 app.set('pool', pool); 등으로 관리 가능

// --- 라우터 임포트 ---
// 각 기능별 API 라우트 파일을 가져옵니다. (실제 파일 경로에 맞게 수정 필요)
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const datasetRoutes = require("./routes/datasetRoutes");
const gameRoutes = require("./routes/gameRoutes");
const homeworkRoutes = require("./routes/homeworkRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const contentRoutes = require("./routes/contentRoutes");

// --- Swagger UI 설정 ---
const swaggerOptions = {
  definition: {
    openapi: "3.0.0", // OpenAPI 사양 버전
    info: {
      title: "Vocaman API", // API 문서 제목
      version: "2.0.0", // API 버전
      description: "Vocaman v2.0 Backend API Documentation", // API 설명
    },
    servers: [
      {
        // NAS 외부 IP와 외부로 매핑된 포트를 사용하도록 설정 (URL에서 /api/v2 제거)
        url: `http://182.221.127.172:${NAS_EXTERNAL_PORT}`, // 수정된 부분
        description: "Development server (NAS)",
      },
      // 로컬 개발 환경에서 테스트할 경우를 위한 서버 정보 (선택 사항)
      // {
      //   url: `http://localhost:${APP_INTERNAL_PORT}`, // 수정된 부분 (필요시)
      //   description: "Local Development Server"
      // }
    ],
    // JWT Bearer 토큰 인증을 Swagger UI에서 사용할 수 있도록 설정
    components: {
      securitySchemes: {
        bearerAuth: {
          // 인증 스킴 이름 (임의 지정 가능)
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT", // 토큰 형식 (선택 사항)
        },
      },
    },
    // API 전역에 Bearer 토큰 인증을 기본으로 요구하도록 설정 (각 API에서 개별 설정도 가능)
    security: [
      {
        bearerAuth: [], // 위에서 정의한 securityScheme 이름 사용
      },
    ],
  },
  // JSDoc 주석이 포함된 API 라우트 파일들의 경로를 지정
  apis: ["./routes/*.js"], // 실제 라우트 파일 위치에 맞게 수정
};

// swagger-jsdoc을 사용하여 Swagger 명세(JSON) 생성
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// --- API 라우트 적용 ---

// Swagger UI 페이지를 제공할 경로 설정
// '/api-docs' 경로로 접속하면 Swagger UI가 표시됩니다.
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 각 기능별 API 라우터를 Express 앱에 등록
app.use("/api/v2/auth", authRoutes); // 인증 관련 API
app.use("/api/v2/users", userRoutes); // 사용자 관련 API
app.use("/api/v2/datasets", datasetRoutes); // 데이터셋 관련 API
app.use("/api/v2/game", gameRoutes); // 게임 관련 API
app.use("/api/v2/homework", homeworkRoutes); // 숙제 관련 API
app.use("/api/v2/notifications", notificationRoutes); // 알림 관련 API
app.use("/api/v2", contentRoutes); // 콘텐츠(Concepts, Terms, Audio 등) 관련 API

// --- 기본 라우트 및 헬스 체크 ---

// 서버 상태 및 데이터베이스 연결 확인을 위한 헬스 체크 엔드포인트
app.get("/api/health", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query("SELECT 1"); // 간단한 쿼리로 DB 연결 확인
    res.status(200).json({
      status: "OK",
      message: "서버 정상 동작 및 데이터베이스 연결 성공",
      dbConnection: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("헬스 체크 중 오류 발생:", error);
    res.status(503).json({
      status: "Error",
      message: "서버는 동작 중이나 데이터베이스 연결 실패",
      dbConnection: false,
      error: error.message, // 운영 환경에서는 상세 오류 메시지 노출에 주의
      timestamp: new Date().toISOString(),
    });
  } finally {
    if (conn) conn.release(); // 사용한 연결은 반드시 풀에 반환
  }
});

// 루트 경로 요청에 대한 기본 응답
app.get("/", (req, res) => {
  res.json({ message: "Vocaman 백엔드 서버에 오신 것을 환영합니다!" });
});

// --- 서버 시작 ---
// APP_INTERNAL_PORT에서 요청을 수신하도록 서버를 시작합니다.
app.listen(APP_INTERNAL_PORT, async () => {
  console.log(`서버가 포트 ${APP_INTERNAL_PORT} 에서 실행 중입니다.`);
  console.log(
    `Swagger API 문서: http://<NAS 외부 IP 또는 localhost>:${NAS_EXTERNAL_PORT}/api-docs`
  ); // Swagger UI 접속 주소 안내

  // 서버 시작 시 데이터베이스 연결 테스트 (선택 사항)
  let conn;
  try {
    conn = await pool.getConnection();
    console.log(
      `데이터베이스 '${dbConfig.database}' 연결 성공! (연결 ID: ${conn.threadId})`
    );
  } catch (err) {
    console.error("서버 시작 중 데이터베이스 연결 실패:", err);
    // 치명적인 오류로 간주하여 서버를 종료할 수도 있습니다.
    // process.exit(1);
  } finally {
    if (conn) conn.release();
  }
});
