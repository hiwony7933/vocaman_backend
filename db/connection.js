const mariadb = require("mariadb");
const dbConfig = require("../config/db.config.js");

// 연결 풀 생성 (여러 요청을 효율적으로 처리하기 위해)
const pool = mariadb.createPool(dbConfig);

// 연결 테스트 함수 (선택 사항)
async function testConnection() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log(
      `데이터베이스 '${dbConfig.database}' 연결 성공! (연결 ID: ${conn.threadId})`
    );
    return true;
  } catch (err) {
    console.error("데이터베이스 연결 실패:", err);
    return false;
  } finally {
    if (conn) conn.release(); // 연결 반환
  }
}

module.exports = {
  pool, // 다른 모듈에서 쿼리를 실행할 때 사용
  testConnection,
};
