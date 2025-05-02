// routes/homeworkRoutes.js
const express = require("express");
const router = express.Router();
const homeworkController = require("../controllers/homeworkController");
const authenticateToken = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Homework
 *   description: 숙제 할당, 조회, 진행 관리
 */

// 숙제 관련 라우트는 인증 필요
router.use(authenticateToken);

/**
 * @swagger
 * /api/v2/homework/assignments:
 *   post:
 *     summary: 부모가 자녀에게 숙제 할당
 *     tags: [Homework]
 *     security:
 *       - bearerAuth: []
 *     description: 부모 사용자만 호출 가능합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - childUserId
 *               - datasetId
 *             properties:
 *               childUserId:
 *                 type: integer
 *                 description: 숙제를 할당할 자녀의 사용자 ID
 *               datasetId:
 *                 type: integer
 *                 description: 숙제로 사용할 데이터셋 ID
 *               reward:
 *                 type: integer
 *                 description: 숙제 완료 시 지급할 마일리지 (선택 사항, 기본값 0)
 *                 default: 0
 *     responses:
 *       201:
 *         description: 숙제 할당 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 assignmentId:
 *                   type: integer
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (부모-자녀 관계 오류 등)
 *       404:
 *         description: 자녀 또는 데이터셋을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post("/assignments", homeworkController.assignHomework);

/**
 * @swagger
 * /api/v2/homework/assignments/assigned_to_me:
 *   get:
 *     summary: (자녀) 나에게 할당된 숙제 목록 조회
 *     tags: [Homework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [assigned, in_progress, completed]
 *         description: 조회할 숙제 상태 필터 (구현 예정)
 *     responses:
 *       200:
 *         description: 숙제 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HomeworkAssignmentDetail' # 아래 components에 정의 필요
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get(
  "/assignments/assigned_to_me",
  homeworkController.getAssignedHomework
);

/**
 * @swagger
 * /api/v2/homework/assignments/created_by_me:
 *   get:
 *     summary: (부모) 내가 생성한 숙제 목록 조회
 *     tags: [Homework]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 숙제 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HomeworkAssignmentDetail'
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/assignments/created_by_me", homeworkController.getCreatedHomework);

/**
 * @swagger
 * /api/v2/homework/assignments/{assignmentId}:
 *   get:
 *     summary: 숙제 상세 정보 조회
 *     tags: [Homework]
 *     security:
 *       - bearerAuth: []
 *     description: 숙제를 할당한 부모 또는 숙제를 받은 자녀만 조회 가능합니다.
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 조회할 숙제의 ID
 *     responses:
 *       200:
 *         description: 숙제 상세 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/HomeworkAssignmentDetail'
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 숙제를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get("/assignments/:assignmentId", homeworkController.getHomeworkDetails);

/**
 * @swagger
 * /api/v2/homework/assignments/{assignmentId}:
 *   put:
 *     summary: (부모) 숙제 정보 수정
 *     tags: [Homework]
 *     security:
 *       - bearerAuth: []
 *     description: '숙제를 할당한 부모만 수정 가능합니다. (예: 보상, 상태 등)'
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 수정할 숙제의 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reward:
 *                 type: integer
 *                 description: 수정할 보상 마일리지
 *               status:
 *                 type: string
 *                 enum: [assigned, cancelled]
 *                 description: '수정할 숙제 상태 (예: 취소)'
 *             minProperties: 1
 *     responses:
 *       200:
 *         description: 숙제 정보 업데이트 성공
 *       400:
 *         description: 잘못된 요청 (수정 내용 없음, 잘못된 status 값)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (숙제 생성자가 아님)
 *       404:
 *         description: 숙제를 찾을 수 없음
 *       409:
 *         description: 업데이트 실패 (동시성 문제 등)
 *       500:
 *         description: 서버 오류
 */
router.put("/assignments/:assignmentId", homeworkController.updateHomework);

/**
 * @swagger
 * /api/v2/homework/assignments/{assignmentId}:
 *   delete:
 *     summary: (부모) 숙제 삭제
 *     tags: [Homework]
 *     security:
 *       - bearerAuth: []
 *     description: 숙제를 할당한 부모만 삭제 가능합니다. 관련 진행 상황도 함께 삭제됩니다.
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 삭제할 숙제의 ID
 *     responses:
 *       200:
 *         description: 숙제 삭제 성공
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (숙제 생성자가 아님)
 *       404:
 *         description: 숙제를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.delete("/assignments/:assignmentId", homeworkController.deleteHomework);

/**
 * @swagger
 * /api/v2/homework/progress:
 *   post:
 *     summary: (자녀) 숙제 진행 상황 제출
 *     tags: [Homework]
 *     security:
 *       - bearerAuth: []
 *     description: 자녀 사용자가 숙제 내 특정 단어 풀이 결과를 제출합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignmentId
 *               - termId
 *               - status
 *             properties:
 *               assignmentId:
 *                 type: integer
 *                 description: 진행 상황을 제출할 숙제 ID
 *               termId:
 *                 type: integer
 *                 description: 풀이한 단어(Term) ID
 *               status:
 *                 type: string
 *                 enum: [correct, incorrect]
 *                 description: 풀이 결과 상태
 *     responses:
 *       200:
 *         description: 진행 상황 제출 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 rewardEarned:
 *                   type: integer
 *                   description: 숙제 완료로 획득한 보상 (0이면 미완료 또는 보상 없음)
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락, 잘못된 status 값, 완료된 숙제)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (해당 숙제 대상자가 아님)
 *       404:
 *         description: 숙제를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post("/progress", homeworkController.submitHomeworkProgress);

/**
 * @swagger
 * /api/v2/homework/assignments/{assignmentId}/progress:
 *   get:
 *     summary: (부모) 특정 숙제에 대한 자녀의 진행 상황 조회
 *     tags: [Homework]
 *     security:
 *       - bearerAuth: []
 *     description: 숙제를 할당한 부모만 조회 가능합니다.
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 진행 상황을 조회할 숙제의 ID
 *     responses:
 *       200:
 *         description: 진행 상황 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/HomeworkProgressDetail' # 아래 components에 정의 필요
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (숙제 생성자가 아님)
 *       404:
 *         description: 숙제를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get(
  "/assignments/:assignmentId/progress",
  homeworkController.getHomeworkProgress
);

/**
 * @swagger
 * components:
 *   schemas:
 *     HomeworkAssignment:
 *       type: object
 *       properties:
 *         assignment_id:
 *           type: integer
 *         parent_user_id:
 *           type: integer
 *         child_user_id:
 *           type: integer
 *         dataset_id:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [assigned, in_progress, completed, cancelled]
 *         reward:
 *           type: integer
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     HomeworkAssignmentDetail: # 조회 시 추가 정보 포함
 *       allOf:
 *         - $ref: '#/components/schemas/HomeworkAssignment'
 *         - type: object
 *           properties:
 *             dataset_name:
 *               type: string
 *             parent_nickname: # 조회 API에 따라 포함 여부 다름
 *               type: string
 *             child_nickname: # 조회 API에 따라 포함 여부 다름
 *               type: string
 *             source_language_code: # 상세 조회 시 포함
 *               type: string
 *             target_language_code: # 상세 조회 시 포함
 *               type: string
 *
 *     HomeworkProgress:
 *       type: object
 *       properties:
 *         progress_id:
 *           type: integer
 *         assignment_id:
 *           type: integer
 *         term_id:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [pending, correct, incorrect]
 *         submitted_at:
 *           type: string
 *           format: date-time
 *
 *     HomeworkProgressDetail: # 조회 시 추가 정보 포함
 *       allOf:
 *         - $ref: '#/components/schemas/HomeworkProgress'
 *         - type: object
 *           properties:
 *             term_text:
 *               type: string
 *             term_language:
 *               type: string
 */

module.exports = router;
