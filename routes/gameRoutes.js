const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");
const authenticateToken = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Gameplay
 *   description: 게임 세션 시작 및 결과 기록
 */

// 게임 관련 라우트는 인증 필요
router.use(authenticateToken);

/**
 * @swagger
 * /api/v2/game/session:
 *   get:
 *     summary: 특정 데이터셋으로 게임 세션 시작
 *     tags: [Gameplay]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dataset_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 게임을 시작할 데이터셋 ID
 *     responses:
 *       200:
 *         description: 게임 세션 정보 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     datasetInfo:
 *                       $ref: '#/components/schemas/DatasetInfo'
 *                     concepts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ConceptDetail' # datasetRoutes.js 에서 정의한 스키마 재사용
 *       400:
 *         description: 잘못된 요청 (dataset_id 누락)
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 데이터셋을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get("/session", gameController.startGameSession);

/**
 * @swagger
 * /api/v2/game/session/default:
 *   get:
 *     summary: 사용자의 목표 학년에 맞는 기본 데이터셋으로 게임 세션 시작
 *     tags: [Gameplay]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: grade
 *         required: true
 *         schema:
 *           type: integer
 *         description: 사용자의 목표 학년
 *         example: 3
 *     responses:
 *       200:
 *         description: 게임 세션 정보 반환 성공
 *         content:
 *           application/json:
 *             schema:
 *               # /session 응답과 동일한 스키마 사용
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     datasetInfo:
 *                       $ref: '#/components/schemas/DatasetInfo'
 *                     concepts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ConceptDetail'
 *       400:
 *         description: 잘못된 요청 (grade 누락)
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 해당 학년의 기본 데이터셋을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get("/session/default", gameController.startGameSessionDefault);

/**
 * @swagger
 * /api/v2/game/logs:
 *   post:
 *     summary: 게임 플레이 결과 기록
 *     tags: [Gameplay]
 *     security:
 *       - bearerAuth: []
 *     description: 게임 중 맞힘/틀림 결과를 기록하고 사용자 통계를 업데이트합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - termId
 *               - datasetId
 *               - wasCorrect
 *               - attempts
 *             properties:
 *               termId:
 *                 type: integer
 *                 description: 결과를 기록할 Term ID
 *               datasetId:
 *                 type: integer
 *                 description: 플레이한 데이터셋 ID (언어쌍 및 통계 업데이트용)
 *               wasCorrect:
 *                 type: boolean
 *                 description: '정답 여부 (true: 맞음, false: 틀림)'
 *               attempts:
 *                 type: integer
 *                 description: 시도 횟수
 *               source:
 *                 type: string
 *                 description: "결과 출처 (예: 'game', 'homework') - 기본값 'game'"
 *                 default: game
 *     responses:
 *       201:
 *         description: 게임 결과 기록 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 logId:
 *                   type: integer
 *                   description: 생성된 게임 로그 ID
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락)
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 데이터셋 정보를 찾을 수 없음 (통계 업데이트 실패 시)
 *       500:
 *         description: 서버 오류
 */
router.post("/logs", gameController.logGameResult);

module.exports = router;
