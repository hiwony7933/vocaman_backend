const dotenv = require("dotenv");
dotenv.config(); // .env 파일 로드

module.exports = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 5, // 동시에 유지할 수 있는 최대 연결 수 (조정 가능)
};
