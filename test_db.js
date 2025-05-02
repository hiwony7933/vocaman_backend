// test_db.js
const mariadb = require("mariadb");

const config = {
  host: "182.221.127.172", // 자택 외부 IP
  port: 3308, // Docker 로컬 포트
  user: "vocaman_user", // DB 사용자
  password: "92ghlrhks!@#", // DB 비밀번호 (현재 설정된 값)
  database: "vocamandatabase",
  connectionTimeout: 5000, // 연결 타임아웃 시간 (5초)
};

async function runTest() {
  let conn;
  try {
    console.log("데이터베이스 연결 시도...");
    conn = await mariadb.createConnection(config);
    console.log("데이터베이스 연결 성공!");
    console.log("연결 스레드 ID:", conn.threadId);
    await conn.query("SELECT 1 as val");
    console.log("간단한 쿼리 실행 성공!");
  } catch (err) {
    console.error("데이터베이스 연결 또는 쿼리 오류:", err);
  } finally {
    if (conn) {
      console.log("연결 종료 중...");
      await conn.end();
      console.log("연결 종료됨.");
    }
  }
}

runTest();
