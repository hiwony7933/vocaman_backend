const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authenticateToken = require("../middleware/authMiddleware"); // 인증 미들웨어 임포트

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: 사용자 프로필, 설정, 관계 관리
 */

/**
 * @swagger
 * /api/v2/users/me:
 *   get:
 *     summary: 현재 로그인된 사용자 정보 조회
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공적으로 사용자 정보 조회
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
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
 *       401:
 *         description: 인증 실패 (유효하지 않은 토큰)
 *       403:
 *         description: 권한 없음
 */
router.get("/me", authenticateToken, userController.getMyProfile);

/**
 * @swagger
 * /api/v2/users/me:
 *   put:
 *     summary: 현재 로그인된 사용자 정보 수정
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *                 description: 변경할 닉네임
 *                 example: NewNickname
 *               # 다른 수정 가능한 필드 추가 가능
 *     responses:
 *       200:
 *         description: 프로필 정보 업데이트 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 프로필 정보가 성공적으로 업데이트되었습니다.
 *                 nickname:
 *                   type: string
 *                   example: NewNickname
 *       400:
 *         description: 잘못된 요청 (닉네임 누락 등)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 사용자를 찾을 수 없음 (이론상 발생 어려움)
 *       500:
 *         description: 서버 오류
 */
router.put("/me", authenticateToken, userController.updateMyProfile);

/**
 * @swagger
 * /api/v2/users/me/settings:
 *   get:
 *     summary: 현재 로그인된 사용자 설정 조회
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 설정 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   description: 사용자 설정 객체 (JSON)
 *                   example: { "targetGrade": 3, "keyboardLayout": "qwerty" }
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get("/me/settings", authenticateToken, userController.getMySettings);

/**
 * @swagger
 * /api/v2/users/me/settings:
 *   put:
 *     summary: 현재 로그인된 사용자 설정 업데이트
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: 업데이트할 설정 객체 전체
 *             example: { "targetGrade": 4, "keyboardLayout": "dvorak", "preferredLanguage": "en" }
 *     responses:
 *       200:
 *         description: 설정 업데이트 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 설정이 성공적으로 업데이트되었습니다.
 *                 data:
 *                   type: object
 *                   description: 업데이트된 설정 객체
 *       400:
 *         description: 잘못된 요청 형식
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 사용자를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.put("/me/settings", authenticateToken, userController.updateMySettings);

/**
 * @swagger
 * /api/v2/users/me/relations/request:
 *   post:
 *     summary: 부모가 자녀에게 관계 맺기 요청 발송
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - childEmail
 *             properties:
 *               childEmail:
 *                 type: string
 *                 format: email
 *                 description: 관계를 맺을 자녀의 이메일 주소
 *                 example: child@example.com
 *     responses:
 *       201:
 *         description: 관계 요청 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 관계 요청을 성공적으로 보냈습니다.
 *                 relationId:
 *                   type: integer
 *                   description: 생성된 관계 요청 ID
 *       400:
 *         description: 잘못된 요청 (이메일 누락, 자기 자신에게 요청)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 자녀 사용자를 찾을 수 없음
 *       409:
 *         description: 이미 관계 요청이 존재하거나 승인된 관계
 *       500:
 *         description: 서버 오류
 */
router.post(
  "/me/relations/request",
  authenticateToken,
  userController.requestRelation
);

/**
 * @swagger
 * /api/v2/users/me/relations:
 *   get:
 *     summary: 현재 로그인된 사용자의 관계 목록 조회
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: 내가 부모인 경우 자녀 목록, 자녀인 경우 부모 목록 및 받은 요청 등을 반환합니다.
 *     responses:
 *       200:
 *         description: 관계 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     pendingReceived: # 내가 받은 요청 (자녀 입장)
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RelationInfo'
 *                     pendingSent: # 내가 보낸 요청 (부모 입장)
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RelationInfo'
 *                     parents: # 승인된 부모 목록
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RelationInfo'
 *                     children: # 승인된 자녀 목록
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RelationInfo'
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/me/relations", authenticateToken, userController.getMyRelations);

/**
 * @swagger
 * /api/v2/users/me/relations/{relationId}:
 *   put:
 *     summary: 자녀가 받은 관계 요청 수락 또는 거절
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: relationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 처리할 관계 요청의 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 description: 요청 처리 상태 ('approved' 또는 'rejected')
 *     responses:
 *       200:
 *         description: 관계 요청 처리 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 관계 요청을 성공적으로 수락했습니다.
 *       400:
 *         description: 잘못된 요청 (잘못된 status 값, 이미 처리된 요청)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (본인이 받은 요청이 아님)
 *       404:
 *         description: 관계 요청을 찾을 수 없음
 *       409:
 *         description: 상태 업데이트 실패 (동시성 문제 등)
 *       500:
 *         description: 서버 오류
 */
router.put(
  "/me/relations/:relationId",
  authenticateToken,
  userController.handleRelationRequest
);

/**
 * @swagger
 * /api/v2/users/me/stats:
 *   get:
 *     summary: 현재 로그인된 사용자의 게임 통계 조회
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lang_pair
 *         required: true
 *         schema:
 *           type: string
 *         description: "조회할 언어쌍 코드 (예: 'ko-en')"
 *         example: ko-en
 *     responses:
 *       200:
 *         description: 통계 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     language_pair_code:
 *                       type: string
 *                       example: ko-en
 *                     wins:
 *                       type: integer
 *                     losses:
 *                       type: integer
 *                     current_streak:
 *                       type: integer
 *                     best_streak:
 *                       type: integer
 *       400:
 *         description: 잘못된 요청 (lang_pair 누락)
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/me/stats", authenticateToken, userController.getUserStats);

/**
 * @swagger
 * components:
 *   schemas:
 *     RelationInfo:
 *       type: object
 *       properties:
 *         relation_id:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         # 부모 또는 자녀 정보 (컨트롤러 반환값에 맞춰 추가)
 *         parent_id:
 *           type: integer
 *         parent_nickname:
 *           type: string
 *         parent_email:
 *           type: string
 *         child_id:
 *           type: integer
 *         child_nickname:
 *           type: string
 *         child_email:
 *           type: string
 */

module.exports = router;
