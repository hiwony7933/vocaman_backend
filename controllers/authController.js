const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken"); // jsonwebtoken 임포트
const { pool } = require("../config/db.config.js"); // db.config.js에서 직접 pool 가져오기
const { OAuth2Client } = require("google-auth-library"); // Google 라이브러리 임포트

const SALT_ROUNDS = 10; // 비밀번호 해싱 강도

// JWT 설정
const JWT_SECRET = process.env.JWT_SECRET; // .env 파일에서 시크릿 키 로드
const ACCESS_TOKEN_EXPIRES_IN = "1h"; // 액세스 토큰 유효 기간 (예: 1시간)
const REFRESH_TOKEN_EXPIRES_IN = "7d"; // 리프레시 토큰 유효 기간 (예: 7일)

// Google OAuth 설정
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // .env 파일에서 클라이언트 ID 로드
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// TODO: 데이터베이스 연결 풀 가져오기 (예: ../db/connection 또는 ../server)
// const pool = require('../path/to/pool');

// POST /api/v2/auth/register
exports.register = async (req, res) => {
  const { email, password, nickname } = req.body;

  // 1. 입력값 유효성 검사 (기본)
  if (!email || !password || !nickname) {
    return res
      .status(400)
      .json({ message: "Email, password, nickname은 필수 입력 항목입니다." });
  }

  let conn;
  try {
    // 2. 데이터베이스 연결 얻기
    conn = await pool.getConnection();

    // 3. 이메일 중복 확인
    const [existingUsers] = await conn.query(
      "SELECT user_id FROM Users WHERE email = ?",
      [email]
    );
    if (existingUsers) {
      return res.status(409).json({ message: "이미 사용 중인 이메일입니다." }); // 409 Conflict
    }

    // 4. 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 5. 사용자 정보 DB 저장 (기본 role 'student'로 설정)
    const result = await conn.query(
      "INSERT INTO Users (email, password_hash, nickname, role) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, nickname, "student"]
    );

    console.log("User registered:", {
      userId: result.insertId,
      email,
      nickname,
    });

    // 6. 성공 응답
    res.status(201).json({
      // 201 Created
      message: "회원가입이 성공적으로 완료되었습니다.",
      userId: result.insertId.toString(), // BigInt를 String으로 변환
    });
  } catch (error) {
    console.error("회원가입 중 오류 발생:", error);
    res.status(500).json({ message: "서버 오류로 회원가입에 실패했습니다." }); // 500 Internal Server Error
  } finally {
    // 7. 데이터베이스 연결 반환
    if (conn) conn.release();
  }
};

// POST /api/v2/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  // 1. 입력값 유효성 검사
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email과 password는 필수 입력 항목입니다." });
  }

  let conn;
  try {
    // 2. 데이터베이스 연결 얻기
    conn = await pool.getConnection();

    // 3. 이메일로 사용자 정보 조회 (비밀번호 해시 포함)
    const [users] = await conn.query(
      "SELECT user_id, email, password_hash, role, nickname FROM Users WHERE email = ?",
      [email]
    );
    const user = users; // mariadb는 결과가 배열이 아닌 직접 객체로 나올 수 있음

    if (!user) {
      return res.status(401).json({
        message: "등록되지 않은 이메일이거나 비밀번호가 올바르지 않습니다.",
      }); // 401 Unauthorized
    }

    // 4. 비밀번호 비교
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "등록되지 않은 이메일이거나 비밀번호가 올바르지 않습니다.",
      }); // 401 Unauthorized
    }

    // 5. JWT 토큰 생성
    const accessTokenPayload = {
      userId: user.user_id.toString(), // BigInt를 String으로 변환
      email: user.email,
      role: user.role,
      nickname: user.nickname,
      // 필요에 따라 다른 정보 추가 가능
    };
    const refreshTokenPayload = {
      userId: user.user_id.toString(), // BigInt를 String으로 변환
      // 리프레시 토큰에는 최소한의 정보만 포함
    };

    const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
    const refreshToken = jwt.sign(refreshTokenPayload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    console.log("User logged in:", { userId: user.user_id, email: user.email });

    // 6. 성공 응답 (토큰 포함)
    res.status(200).json({
      // 200 OK
      message: "로그인 성공",
      accessToken,
      refreshToken,
      user: {
        // 사용자 정보도 함께 반환 (선택 사항)
        userId: user.user_id.toString(), // BigInt -> String
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("로그인 중 오류 발생:", error);
    res.status(500).json({ message: "서버 오류로 로그인에 실패했습니다." }); // 500 Internal Server Error
  } finally {
    // 7. 데이터베이스 연결 반환
    if (conn) conn.release();
  }
};

// POST /api/v2/auth/google/login
exports.googleLogin = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: "Google ID 토큰이 필요합니다." });
  }

  let conn;
  try {
    // 1. Google ID 토큰 검증
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleUserId = payload["sub"];
    const email = payload["email"];
    const nickname = payload["name"]; // Google 프로필 이름 사용 (또는 다른 필드)

    if (!email) {
      return res
        .status(400)
        .json({ message: "Google 계정에서 이메일 정보를 가져올 수 없습니다." });
    }

    // 2. 데이터베이스 연결 얻기
    conn = await pool.getConnection();

    // 3. google_id 또는 email로 사용자 조회
    let [users] = await conn.query(
      "SELECT user_id, email, role, nickname, google_id FROM Users WHERE google_id = ? OR email = ?",
      [googleUserId, email]
    );
    let user = users; // mariadb 드라이버 버전에 따라 배열이 아닌 객체 반환 가능

    // 4. 사용자 존재 여부에 따른 처리
    if (user) {
      // 기존 사용자: google_id가 없으면 업데이트 (이메일로 가입 후 구글 연동)
      if (!user.google_id) {
        await conn.query("UPDATE Users SET google_id = ? WHERE user_id = ?", [
          googleUserId,
          user.user_id,
        ]);
        user.google_id = googleUserId; // 로컬 user 객체에도 반영
        console.log(`Google ID linked for user: ${user.email}`);
      }
      console.log("Existing user logged in via Google:", {
        userId: user.user_id,
        email: user.email,
      });
    } else {
      // 신규 사용자: DB에 등록 (비밀번호는 null 또는 임의 값, google_id 저장)
      const insertResult = await conn.query(
        "INSERT INTO Users (email, nickname, google_id, role) VALUES (?, ?, ?, ?)",
        [email, nickname || email.split("@")[0], googleUserId, "student"] // 닉네임 없으면 이메일 앞부분 사용
      );
      // 새로 생성된 사용자 정보 다시 조회 (user_id 등 필요)
      [users] = await conn.query(
        "SELECT user_id, email, role, nickname, google_id FROM Users WHERE user_id = ?",
        [insertResult.insertId]
      );
      user = users;
      console.log("New user registered and logged in via Google:", {
        userId: user.user_id,
        email: user.email,
      });
    }

    // 5. JWT 토큰 생성
    const accessTokenPayload = {
      userId: user.user_id.toString(), // BigInt를 String으로 변환
      email: user.email,
      role: user.role,
      nickname: user.nickname,
    };
    const refreshTokenPayload = { userId: user.user_id.toString() }; // BigInt를 String으로 변환

    const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
    const refreshToken = jwt.sign(refreshTokenPayload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    // 6. 성공 응답
    res.status(200).json({
      message: "Google 로그인 성공",
      accessToken,
      refreshToken,
      user: {
        // 사용자 정보도 함께 반환
        userId: user.user_id.toString(), // BigInt -> String
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Google 로그인 중 오류 발생:", error);
    if (
      error.message.includes("Invalid token signature") ||
      error.message.includes("Token used too late")
    ) {
      return res
        .status(401)
        .json({ message: "유효하지 않은 Google ID 토큰입니다." });
    }
    res
      .status(500)
      .json({ message: "서버 오류로 Google 로그인에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/v2/auth/logout
exports.logout = async (req, res) => {
  // 현재는 클라이언트 측에서 토큰을 삭제하는 방식.
  // TODO: (보안 강화) 리프레시 토큰을 DB 블랙리스트 등에 추가하여 무효화
  console.log("Logout requested by user (client-side token removal expected).");
  res.status(200).json({
    message:
      "로그아웃 요청이 처리되었습니다. 클라이언트에서 토큰을 삭제해주세요.",
  });
};

// POST /api/v2/auth/refresh
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "리프레시 토큰이 필요합니다." });
  }

  let conn;
  try {
    // 1. 리프레시 토큰 검증
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    // TODO: (보안 강화) DB에 저장된 리프레시 토큰과 비교하여 유효성 재확인

    // 2. DB에서 최신 사용자 정보 조회 (role, nickname 등 변경 가능성 고려)
    conn = await pool.getConnection();
    const [users] = await conn.query(
      "SELECT user_id, email, role, nickname FROM Users WHERE user_id = ?",
      [decoded.userId]
    );
    const user = users;

    if (!user) {
      // 리프레시 토큰은 유효하지만 해당 유저가 DB에 없는 경우 (탈퇴 등)
      return res.status(401).json({ message: "사용자를 찾을 수 없습니다." });
    }

    // 3. 새로운 액세스 토큰 생성
    const newAccessTokenPayload = {
      userId: user.user_id.toString(), // BigInt를 String으로 변환
      email: user.email,
      role: user.role,
      nickname: user.nickname,
    };
    const newAccessToken = jwt.sign(newAccessTokenPayload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    console.log("Access token refreshed for user:", { userId: user.user_id });

    // 4. 성공 응답 (새 액세스 토큰만 반환)
    res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("토큰 갱신 중 오류 발생:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.",
      });
    } else if (error.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ message: "유효하지 않은 리프레시 토큰입니다." });
    }
    res.status(500).json({ message: "서버 오류로 토큰 갱신에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};
