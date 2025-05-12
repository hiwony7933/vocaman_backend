// server.js - 보카맨 백엔드 서버 메인 파일

// --- 필수 모듈 임포트 ---
const express = require("express");
const dotenv = require("dotenv");
// const mariadb = require("mariadb"); // 이제 config/db.config.js에서 관리하므로 여기서 직접 필요 X
const path = require("path"); // 파일 경로 관련 모듈
const swaggerJsdoc = require("swagger-jsdoc"); // Swagger JSDoc 생성기
const swaggerUi = require("swagger-ui-express"); // Swagger UI 미들웨어
const cors = require("cors"); // cors 모듈 임포트

// --- .env 파일 로드 ---
// 애플리케이션 설정 및 민감한 정보를 .env 파일에서 로드합니다.
// 이 호출은 process.env를 사용하기 전에 가장 먼저 이루어져야 합니다.
dotenv.config();

// --- Express 앱 생성 및 기본 설정 ---
const app = express();
// 컨테이너 내부에서 사용할 포트 번호 (PORT 환경 변수 또는 기본값 3000)
const APP_INTERNAL_PORT = process.env.PORT || 3000;
// NAS에서 외부로 노출시킬 포트 번호 (Swagger UI에서 API 요청 시 사용)
// 이 값은 NAS Docker 포트 매핑과 일치해야 합니다. (예: 8080)
// .env 파일에 EXTERNAL_PORT=8080 와 같이 정의하고 process.env.EXTERNAL_PORT 로 가져올 수도 있습니다.
const NAS_EXTERNAL_PORT = process.env.EXTERNAL_PORT || 8080;

// --- CORS 설정 ---
// 프론트엔드 개발 환경의 출처를 허용합니다.
const allowedOrigins = [
  "http://localhost:8081", // 프론트엔드 개발 환경
  `http://${process.env.NAS_EXTERNAL_IP || "182.221.127.172"}:${
    process.env.EXTERNAL_PORT || 8080
  }`, // Swagger UI (NAS 외부 접속용)
  // 필요하다면 로컬 개발환경에서 Swagger UI 접근 시 출처(예: http://localhost:8080)도 추가할 수 있습니다.
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg =
        "The CORS policy for this site does not allow access from the specified Origin.";
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // 허용할 HTTP 메소드
  allowedHeaders: ["Content-Type", "Authorization"], // 허용할 요청 헤더 (Authorization 추가)
  credentials: true, // 쿠키/인증 정보를 허용할지 여부 (필요한 경우)
  optionsSuccessStatus: 200, // 일부 레거시 브라우저에서 OPTIONS 요청에 204 대신 200을 응답
};

app.use(cors(corsOptions)); // CORS 미들웨어 적용

// 요청 본문(body)을 JSON 형태로 파싱하기 위한 미들웨어
app.use(express.json());
// URL-encoded 형태의 요청 본문 파싱을 위한 미들웨어 (form 데이터 처리 등)
app.use(express.urlencoded({ extended: true }));

// --- 정적 파일 서빙 설정 (선택 사항) ---
// 'public' 폴더에 있는 정적 파일들(예: 이미지, CSS, 프론트엔드 빌드 파일 등)을 제공할 수 있습니다.
app.use(express.static(path.join(__dirname, "public")));
// 특정 경로(예: /audio)에 대한 정적 파일 서빙 (오디오 힌트 파일 등)
app.use("/api/v2/audio", express.static(path.join(__dirname, "public/audio")));

// --- 데이터베이스 연결 풀 가져오기 ---
// config/db.config.js 에서 pool과 testConnection 함수를 가져옵니다.
// 이 파일에서 MariaDB 연결 풀이 생성되고 관리됩니다.
const { pool, testConnection } = require("./config/db.config.js"); // 경로가 정확한지 확인!

// --- 라우터 임포트 ---
// 각 기능별 API 라우트 파일을 가져옵니다. (실제 파일 경로에 맞게 수정 필요)
// 파일이 존재하지 않으면 서버 시작 시 오류가 발생할 수 있으므로,
// 실제 파일들을 생성한 후에 주석을 해제하거나 경로를 맞추세요.
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
      //   // NAS 외부 IP와 외부로 매핑된 포트를 사용하도록 설정
      //   // .env 파일에 NAS_EXTERNAL_IP=182.221.127.172 와 같이 정의하고 사용하는 것이 좋습니다.
      {
        url: `http://${
          process.env.NAS_EXTERNAL_IP || "182.221.127.172"
        }:${NAS_EXTERNAL_PORT}`,
        description: "Development server (NAS)",
      },
      // 로컬 개발 환경에서 테스트할 경우를 위한 서버 정보 (선택 사항)
      // {
      //   url: `http://localhost:${APP_INTERNAL_PORT}`,
      //   description: "Local Development Server",
      // },
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

// 각 기능별 API 라우터를 Express 앱에 등록 (모든 API는 /api/v2 접두사 사용 권장)
app.use("/api/v2/auth", authRoutes); // 인증 관련 API
app.use("/api/v2/users", userRoutes); // 사용자 관련 API
app.use("/api/v2/datasets", datasetRoutes); // 데이터셋 관련 API
app.use("/api/v2/game", gameRoutes); // 게임 관련 API
app.use("/api/v2/homework", homeworkRoutes); // 숙제 관련 API
app.use("/api/v2/notifications", notificationRoutes); // 알림 관련 API
app.use("/api/v2", contentRoutes); // 콘텐츠(Concepts, Terms, Audio 등) 관련 API (내부적으로 /concepts 등 사용)

// --- 기본 라우트 및 헬스 체크 ---

// 서버 상태 및 데이터베이스 연결 확인을 위한 헬스 체크 엔드포인트
app.get("/api/health", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection(); // config/db.config.js에서 가져온 pool 사용
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
    `Swagger API 문서 (NAS 외부 접속 시): http://${
      process.env.NAS_EXTERNAL_IP || "182.221.127.172"
    }:${NAS_EXTERNAL_PORT}/api-docs`
  );
  console.log(
    `Swagger API 문서 (로컬 접속 시, NAS 내부에서): http://localhost:${NAS_EXTERNAL_PORT}/api-docs`
  );

  // 서버 시작 시 데이터베이스 연결 테스트
  // testConnection 함수는 config/db.config.js 에서 export 된 것을 사용합니다.
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error(
      "!!! 치명적 오류: 데이터베이스 연결에 실패하여 서버 기능이 제한될 수 있습니다 !!!"
    );
    // 필요에 따라 여기서 process.exit(1) 등으로 서버를 강제 종료할 수도 있습니다.
  }
});
