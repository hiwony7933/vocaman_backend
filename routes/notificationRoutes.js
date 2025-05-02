const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const authenticateToken = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: 사용자 알림 관리
 */

// 알림 관련 라우트는 인증 필요
router.use(authenticateToken);

/**
 * @swagger
 * /api/v2/notifications:
 *   get:
 *     summary: 현재 로그인된 사용자의 알림 목록 조회
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 알림 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 unreadCount:
 *                   type: integer
 *                   description: 읽지 않은 알림 수
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/", notificationController.getNotifications);

/**
 * @swagger
 * /api/v2/notifications/{notificationId}/read:
 *   post:
 *     summary: 특정 알림을 읽음 상태로 변경
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 읽음 처리할 알림의 ID
 *     responses:
 *       200:
 *         description: 성공적으로 읽음 처리됨
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (본인 알림이 아님)
 *       404:
 *         description: 알림을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post(
  "/:notificationId/read",
  notificationController.markNotificationAsRead
);

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         notification_id:
 *           type: integer
 *         # recipient_user_id: # 응답에는 보통 불필요
 *         #   type: integer
 *         type:
 *           type: string
 *           description: "알림 종류 (예: 'homework_assigned', 'relation_requested')"
 *         message:
 *           type: string
 *           description: 알림 내용
 *         is_read:
 *           type: boolean
 *           description: 읽음 여부
 *         created_at:
 *           type: string
 *           format: date-time
 */

module.exports = router;
