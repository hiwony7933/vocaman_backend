const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  // 1. Authorization 헤더 확인
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

  // 2. 토큰 존재 여부 확인
  if (token == null) {
    return res.status(401).json({ message: "인증 토큰이 필요합니다." }); // 401 Unauthorized
  }

  // 3. 토큰 검증
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "토큰이 만료되었습니다." }); // 만료된 경우 401
      }
      // 그 외 검증 실패 (예: 잘못된 서명)
      return res.status(403).json({ message: "유효하지 않은 토큰입니다." }); // 403 Forbidden
    }

    // 4. 검증 성공 시 사용자 정보를 req 객체에 추가
    req.user = user; // 페이로드에 담았던 사용자 정보 (userId, role 등)
    next(); // 다음 미들웨어 또는 라우트 핸들러로 이동
  });
};

module.exports = authenticateToken;
