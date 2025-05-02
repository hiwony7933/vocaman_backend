const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: 사용자 인증 및 토큰 관리
 */

/**
 * @swagger
 * /api/v2/auth/register:
 *   post:
 *     summary: 신규 사용자 회원가입
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nickname
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 사용자 이메일
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: 사용자 비밀번호 (8자 이상 권장)
 *                 example: password123
 *               nickname:
 *                 type: string
 *                 description: 사용자 닉네임
 *                 example: VocamanUser
 *     responses:
 *       201:
 *         description: 회원가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 회원가입이 성공적으로 완료되었습니다.
 *                 userId:
 *                   type: integer
 *                   description: 생성된 사용자 ID
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락)
 *       409:
 *         description: 이메일 중복
 *       500:
 *         description: 서버 오류
 */
// POST /api/v2/auth/register: 신규 사용자 회원가입
router.post("/register", authController.register);

/**
 * @swagger
 * /api/v2/auth/login:
 *   post:
 *     summary: 이메일/비밀번호 기반 로그인
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 로그인 성공
 *                 accessToken:
 *                   type: string
 *                   description: JWT 액세스 토큰
 *                 refreshToken:
 *                   type: string
 *                   description: JWT 리프레시 토큰
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     nickname:
 *                       type: string
 *                     role:
 *                       type: string
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락)
 *       401:
 *         description: 인증 실패 (이메일 또는 비밀번호 오류)
 *       500:
 *         description: 서버 오류
 */
// POST /api/v2/auth/login: 이메일/비밀번호 기반 로그인
router.post("/login", authController.login);

/**
 * @swagger
 * /api/v2/auth/google/login:
 *   post:
 *     summary: Google 소셜 로그인
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: 클라이언트에서 받은 Google ID 토큰
 *     responses:
 *       200:
 *         description: Google 로그인 성공 (기존 사용자 또는 신규 가입 후)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Google 로그인 성공
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     nickname:
 *                       type: string
 *                     role:
 *                       type: string
 *       400:
 *         description: 잘못된 요청 (ID 토큰 누락 또는 Google 계정 정보 부족)
 *       401:
 *         description: 유효하지 않은 Google ID 토큰
 *       500:
 *         description: 서버 오류
 */
// POST /api/v2/auth/google/login: Google 소셜 로그인 처리
router.post("/google/login", authController.googleLogin);

/**
 * @swagger
 * /api/v2/auth/logout:
 *   post:
 *     summary: 사용자 로그아웃 (서버측 로직은 없음)
 *     tags: [Authentication]
 *     description: 현재 구현은 클라이언트 측에서 토큰 삭제를 확인하는 용도입니다.
 *     security: [] # 로그아웃은 토큰 없이도 호출 가능하도록 설정
 *     responses:
 *       200:
 *         description: 로그아웃 요청 처리됨
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 로그아웃 요청이 처리되었습니다. 클라이언트에서 토큰을 삭제해주세요.
 *       500:
 *         description: 서버 오류 (현재는 발생 가능성 낮음)
 */
// POST /api/v2/auth/logout: 사용자 로그아웃
router.post("/logout", authController.logout);

/**
 * @swagger
 * /api/v2/auth/refresh:
 *   post:
 *     summary: 액세스 토큰 갱신
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: 로그인 시 발급받은 리프레시 토큰
 *     responses:
 *       200:
 *         description: 액세스 토큰 갱신 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: 새로 발급된 JWT 액세스 토큰
 *       401:
 *         description: 유효하지 않거나 만료된 리프레시 토큰
 *       500:
 *         description: 서버 오류
 */
// POST /api/v2/auth/refresh: 토큰 갱신
router.post("/refresh", authController.refreshToken);

module.exports = router;
