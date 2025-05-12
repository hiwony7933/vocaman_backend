// config/db.config.js

const mariadb = require("mariadb");
const dotenv = require("dotenv");

dotenv.config(); // .env 파일 로드

// 데이터베이스 연결 설정값
const dbSettings = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 5, // 동시에 유지할 수 있는 최대 연결 수 (조정 가능)
  timezone: "Asia/Seoul", // DB 연결 시 사용할 타임존
  // connectTimeout: 20000, // 필요시 타임아웃 증가
  // acquireTimeout: 20000,
};

// MariaDB 연결 풀 생성
const pool = mariadb.createPool(dbSettings);

// 연결 테스트 함수 (선택 사항, 서버 시작 시 또는 필요시 호출)
async function testConnection() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log(
      `(db.config.js) 데이터베이스 '${dbSettings.database}' 연결 성공! (연결 ID: ${conn.threadId})`
    );
    return true;
  } catch (err) {
    console.error("(db.config.js) 데이터베이스 연결 실패:", err);
    // 에러를 다시 throw하여 호출한 쪽에서 처리하도록 할 수도 있습니다.
    // throw err;
    return false;
  } finally {
    if (conn) conn.release(); // 사용한 연결은 반드시 풀에 반환
  }
}

// 연결 풀(pool) 객체와 테스트 함수를 export
module.exports = {
  pool,
  testConnection,
  dbSettings, // (선택 사항) 설정값 자체도 필요하면 export
};
