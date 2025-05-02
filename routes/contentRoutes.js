const express = require("express");
const router = express.Router();
const contentController = require("../controllers/contentController");
const authenticateToken = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Content
 *   description: 단어 콘텐츠(Concept, Term, Hint, Audio) 조회
 */

/**
 * @swagger
 * /api/v2/concepts/{conceptId}:
 *   get:
 *     summary: 특정 Concept 정보 조회
 *     tags: [Content]
 *     security:
 *       - bearerAuth: [] # 콘텐츠 조회에도 인증 필요
 *     parameters:
 *       - in: path
 *         name: conceptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 조회할 Concept의 ID
 *     responses:
 *       200:
 *         description: Concept 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Concept' # 아래 components에 정의 필요
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: Concept을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get(
  "/concepts/:conceptId",
  authenticateToken,
  contentController.getConceptById
);

/**
 * @swagger
 * /api/v2/terms/{termId}:
 *   get:
 *     summary: 특정 Term 정보 및 관련 Hints 조회
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: termId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 조회할 Term의 ID
 *     responses:
 *       200:
 *         description: Term 정보 조회 성공 (Hints 포함)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Term' # 아래 components에 정의 필요
 *                     - type: object
 *                       properties:
 *                         hints:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Hint' # 아래 components에 정의 필요
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: Term을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get("/terms/:termId", authenticateToken, contentController.getTermById);

/**
 * @swagger
 * /api/v2/audio/{audioRef}:
 *   get:
 *     summary: 오디오 파일 스트리밍/다운로드
 *     tags: [Content]
 *     # security: [] # 오디오 파일은 인증 없이 접근 가능하도록 설정
 *     parameters:
 *       - in: path
 *         name: audioRef
 *         required: true
 *         schema:
 *           type: string
 *         description: Terms 테이블의 audio_ref 값 (파일 경로 또는 식별자)
 *         example: "ko/apple.mp3"
 *     responses:
 *       200:
 *         description: 오디오 파일 스트리밍
 *         content:
 *           audio/mpeg: # 실제 오디오 포맷에 맞게 변경 (예: audio/wav, audio/ogg)
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: 오디오 파일을 찾을 수 없음
 */
// 실제 서빙은 server.js의 static 미들웨어에서 처리됨
router.get("/audio/:audioRef", contentController.getAudio);

/**
 * @swagger
 * components:
 *   schemas:
 *     Concept:
 *       type: object
 *       properties:
 *         concept_id:
 *           type: integer
 *         image_url:
 *           type: string
 *           format: url
 *         created_by:
 *           type: integer
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *     Term:
 *       type: object
 *       properties:
 *         term_id:
 *           type: integer
 *         concept_id:
 *           type: integer
 *         language_code:
 *           type: string
 *         text:
 *           type: string
 *         audio_ref:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *     Hint:
 *       type: object
 *       properties:
 *         hint_id:
 *           type: integer
 *         term_id:
 *           type: integer
 *         hint_type:
 *           type: string
 *           enum: [text, image]
 *         hint_content:
 *           type: string
 *         language_code:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 */

module.exports = router;
