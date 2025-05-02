const express = require("express");
const router = express.Router();
const datasetController = require("../controllers/datasetController");
const authenticateToken = require("../middleware/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Datasets
 *   description: 단어 데이터셋 관리 (생성, 조회, 수정, 삭제, 단어 추가/제거)
 */

// 모든 데이터셋 라우트는 기본적으로 인증 필요
router.use(authenticateToken);

/**
 * @swagger
 * /api/v2/datasets:
 *   post:
 *     summary: 새 데이터셋 생성
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     description: 부모 또는 관리자 역할만 데이터셋 생성이 가능합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - source_language_code
 *               - target_language_code
 *             properties:
 *               name:
 *                 type: string
 *                 description: 데이터셋 이름
 *                 example: "초등 필수 영단어"
 *               source_language_code:
 *                 type: string
 *                 description: '원본 언어 코드 (예: ko)'
 *                 example: "ko"
 *               target_language_code:
 *                 type: string
 *                 description: '대상 언어 코드 (예: en)'
 *                 example: "en"
 *     responses:
 *       201:
 *         description: 데이터셋 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 datasetId:
 *                   type: integer
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (역할 부족)
 *       500:
 *         description: 서버 오류
 */
router.post("/", datasetController.createDataset);

/**
 * @swagger
 * /api/v2/datasets:
 *   get:
 *     summary: 데이터셋 목록 조회
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, mine, official]
 *         description: '조회 필터 (구현 예정: all, 내가 만든 것, 공식 등)'
 *       - in: query
 *         name: lang_pair
 *         schema:
 *           type: string
 *         description: '언어쌍 필터 (예: ko-en) (구현 예정)'
 *       # TODO: 페이지네이션 파라미터 추가 (page, limit)
 *     responses:
 *       200:
 *         description: 데이터셋 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DatasetInfo'
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/", datasetController.getAllDatasets);

/**
 * @swagger
 * /api/v2/datasets/{datasetId}:
 *   get:
 *     summary: 특정 데이터셋 상세 정보 조회
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 조회할 데이터셋의 ID
 *     responses:
 *       200:
 *         description: 상세 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/DatasetInfo'
 *                     - type: object
 *                       properties:
 *                         concepts: # 상세 조회 시 포함될 단어 정보 (구현 필요)
 *                           type: array
 *                           items:
 *                              $ref: '#/components/schemas/ConceptDetail' # 아래 components에 정의 필요
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 데이터셋을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get("/:datasetId", datasetController.getDatasetById);

/**
 * @swagger
 * /api/v2/datasets/{datasetId}:
 *   put:
 *     summary: 데이터셋 정보 수정
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     description: 데이터셋 소유자 또는 관리자만 수정 가능합니다.
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 수정할 데이터셋의 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               source_language_code:
 *                 type: string
 *               target_language_code:
 *                 type: string
 *             minProperties: 1 # 최소 하나 이상의 필드 필요
 *     responses:
 *       200:
 *         description: 데이터셋 업데이트 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 잘못된 요청 (수정할 내용 없음)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음 (소유자가 아님)
 *       404:
 *         description: 데이터셋을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.put("/:datasetId", datasetController.updateDataset);

/**
 * @swagger
 * /api/v2/datasets/{datasetId}:
 *   delete:
 *     summary: 데이터셋 삭제
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     description: 데이터셋 소유자 또는 관리자만 삭제 가능합니다. 관련 숙제 등이 있으면 삭제가 제한될 수 있습니다.
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 삭제할 데이터셋의 ID
 *     responses:
 *       200:
 *         description: 데이터셋 삭제 성공
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
 *         description: 권한 없음 (소유자가 아님)
 *       404:
 *         description: 데이터셋을 찾을 수 없음
 *       500:
 *         description: 서버 오류 (관련 데이터 제약 조건 등)
 */
router.delete("/:datasetId", datasetController.deleteDataset);

/**
 * @swagger
 * /api/v2/datasets/{datasetId}/concepts:
 *   post:
 *     summary: 데이터셋에 기존 단어(Concept) 추가
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     description: 데이터셋 소유자 또는 관리자만 추가 가능합니다.
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 단어를 추가할 데이터셋 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conceptId
 *             properties:
 *               conceptId:
 *                 type: integer
 *                 description: 데이터셋에 추가할 기존 Concept의 ID
 *     responses:
 *       201:
 *         description: 성공적으로 단어 추가
 *       400:
 *         description: 잘못된 요청 (Concept ID 누락)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 데이터셋 또는 Concept을 찾을 수 없음
 *       409:
 *         description: 이미 데이터셋에 해당 단어가 존재함
 *       500:
 *         description: 서버 오류
 */
router.post("/:datasetId/concepts", datasetController.addConceptToDataset);

/**
 * @swagger
 * /api/v2/datasets/{datasetId}/concepts/{conceptId}:
 *   delete:
 *     summary: 데이터셋에서 단어(Concept) 제거
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     description: 데이터셋 소유자 또는 관리자만 제거 가능합니다.
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 단어를 제거할 데이터셋 ID
 *       - in: path
 *         name: conceptId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 데이터셋에서 제거할 Concept ID
 *     responses:
 *       200:
 *         description: 성공적으로 단어 제거
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 데이터셋 또는 데이터셋 내 해당 단어를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.delete(
  "/:datasetId/concepts/:conceptId",
  datasetController.removeConceptFromDataset
);

/**
 * @swagger
 * /api/v2/datasets/{datasetId}/terms:
 *   post:
 *     summary: 데이터셋에 커스텀 단어(Term 및 Hint) 추가
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     description: 데이터셋 소유자 또는 관리자만 커스텀 단어 추가 가능. 새 Concept 생성 또는 기존 Concept에 추가 가능.
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 커스텀 단어를 추가할 데이터셋 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomWordInput' # 아래 components에 정의 필요
 *     responses:
 *       201:
 *         description: 성공적으로 커스텀 단어 추가
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 conceptId:
 *                   type: integer
 *                   description: 생성되었거나 사용된 Concept ID
 *       400:
 *         description: 잘못된 요청 (입력 데이터 구조 오류 등)
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 데이터셋 또는 (기존) Concept을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.post("/:datasetId/terms", datasetController.addCustomWordToDataset);

/**
 * @swagger
 * components:
 *   schemas:
 *     DatasetInfo:
 *       type: object
 *       properties:
 *         dataset_id:
 *           type: integer
 *         name:
 *           type: string
 *         source_language_code:
 *           type: string
 *         target_language_code:
 *           type: string
 *         owner_user_id:
 *           type: integer
 *         owner_nickname:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         # TODO: is_official, recommended_grade 등 추가 필드 반영
 *
 *     ConceptDetail:
 *       type: object
 *       properties:
 *         conceptId:
 *           type: integer
 *         imageUrl:
 *           type: string
 *           format: url
 *         terms:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TermDetail' # 아래 정의 필요
 *
 *     TermDetail:
 *       type: object
 *       properties:
 *         termId:
 *           type: integer
 *         languageCode:
 *           type: string
 *         text:
 *           type: string
 *         audioRef:
 *           type: string
 *         hints:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/HintDetail' # 아래 정의 필요
 *
 *     HintDetail:
 *       type: object
 *       properties:
 *         hintId:
 *           type: integer
 *         type:
 *           type: string
 *           enum: [text, image, audio]
 *         content:
 *           type: string
 *         languageCode:
 *           type: string
 *
 *     CustomWordInput:
 *        type: object
 *        properties:
 *          conceptId:
 *            type: integer
 *            description: (선택) 기존 Concept ID. imageUrl과 동시 사용 불가.
 *          imageUrl:
 *            type: string
 *            format: url
 *            description: (선택) 새 Concept 생성 시 이미지 URL. conceptId와 동시 사용 불가.
 *          terms:
 *            type: array
 *            required: true
 *            minItems: 1
 *            items:
 *              type: object
 *              required:
 *                - language_code
 *                - text
 *              properties:
 *                language_code:
 *                  type: string
 *                  example: ko
 *                text:
 *                  type: string
 *                  example: 사과
 *                audio_ref:
 *                  type: string
 *                  description: (선택) 오디오 파일 참조 경로/ID
 *                  example: audio/ko/apple.mp3
 *                hints:
 *                  type: array
 *                  items:
 *                    type: object
 *                    required:
 *                      - hint_type
 *                      - hint_content
 *                      - language_code
 *                    properties:
 *                      hint_type:
 *                        type: string
 *                        enum: [text, image]
 *                        description: 힌트 타입
 *                      hint_content:
 *                        type: string
 *                        description: 힌트 내용 (텍스트 또는 이미지 URL)
 *                      language_code:
 *                        type: string
 *                        description: 힌트 언어 코드
 */

module.exports = router;
