const { pool } = require("../server");

// POST /api/v2/homework/assignments
exports.assignHomework = async (req, res) => {
  const parentUserId = req.user.userId;
  const { childUserId, datasetId, reward } = req.body;

  // 1. 입력값 유효성 검사
  if (!childUserId || !datasetId) {
    return res
      .status(400)
      .json({ message: "childUserId와 datasetId는 필수 입력 항목입니다." });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 2. 부모-자녀 관계 확인 (승인된 관계)
    const [relations] = await conn.query(
      "SELECT relation_id FROM UserRelations WHERE parent_user_id = ? AND child_user_id = ? AND status = 'approved'",
      [parentUserId, childUserId]
    );
    if (!relations) {
      await conn.rollback();
      return res.status(403).json({
        message: "해당 자녀와 유효한 관계가 아니거나, 자녀를 찾을 수 없습니다.",
      });
    }

    // 3. 데이터셋 존재 확인
    const [datasets] = await conn.query(
      "SELECT dataset_id FROM Datasets WHERE dataset_id = ?",
      [datasetId]
    );
    if (!datasets) {
      await conn.rollback();
      return res.status(404).json({ message: "데이터셋을 찾을 수 없습니다." });
    }

    // 4. 숙제 할당 (기본 status: 'assigned')
    const [result] = await conn.query(
      "INSERT INTO HomeworkAssignments (parent_user_id, child_user_id, dataset_id, status, reward) VALUES (?, ?, ?, ?, ?)",
      [parentUserId, childUserId, datasetId, "assigned", reward || 0] // reward 기본값 0
    );
    const newAssignmentId = result.insertId;

    // TODO: 자녀에게 숙제 할당 알림 생성 (Notifications 테이블)

    await conn.commit();
    console.log(
      `Homework assigned: assignmentId=${newAssignmentId}, parentId=${parentUserId}, childId=${childUserId}, datasetId=${datasetId}`
    );
    res.status(201).json({
      message: "숙제가 성공적으로 할당되었습니다.",
      assignmentId: newAssignmentId.toString(),
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("숙제 할당 중 오류 발생:", error);
    res.status(500).json({ message: "서버 오류로 숙제 할당에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/homework/assignments/assigned_to_me
exports.getAssignedHomework = async (req, res) => {
  const childUserId = req.user.userId;
  let conn;
  try {
    conn = await pool.getConnection();
    // 숙제 정보와 함께 데이터셋 이름, 부모 닉네임 조회
    const query = `
      SELECT ha.*, d.name as dataset_name, u.nickname as parent_nickname
      FROM HomeworkAssignments ha
      JOIN Datasets d ON ha.dataset_id = d.dataset_id
      JOIN Users u ON ha.parent_user_id = u.user_id
      WHERE ha.child_user_id = ?
      ORDER BY ha.created_at DESC
    `;
    const [assignments] = await conn.query(query, [childUserId]);
    res.status(200).json({ data: assignments });
  } catch (error) {
    console.error("할당된 숙제 목록 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 할당된 숙제 목록 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/homework/assignments/created_by_me
exports.getCreatedHomework = async (req, res) => {
  const parentUserId = req.user.userId;
  let conn;
  try {
    conn = await pool.getConnection();
    // 숙제 정보와 함께 데이터셋 이름, 자녀 닉네임 조회
    const query = `
      SELECT ha.*, d.name as dataset_name, u.nickname as child_nickname
      FROM HomeworkAssignments ha
      JOIN Datasets d ON ha.dataset_id = d.dataset_id
      JOIN Users u ON ha.child_user_id = u.user_id
      WHERE ha.parent_user_id = ?
      ORDER BY ha.created_at DESC
    `;
    const [assignments] = await conn.query(query, [parentUserId]);
    res.status(200).json({ data: assignments });
  } catch (error) {
    console.error("생성한 숙제 목록 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 생성한 숙제 목록 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/homework/assignments/{assignment_id}
exports.getHomeworkDetails = async (req, res) => {
  const userId = req.user.userId;
  const { assignmentId } = req.params;
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      SELECT ha.*, d.name as dataset_name, d.source_language_code, d.target_language_code,
             p.nickname as parent_nickname, c.nickname as child_nickname
      FROM HomeworkAssignments ha
      JOIN Datasets d ON ha.dataset_id = d.dataset_id
      JOIN Users p ON ha.parent_user_id = p.user_id
      JOIN Users c ON ha.child_user_id = c.user_id
      WHERE ha.assignment_id = ?
    `;
    const [assignments] = await conn.query(query, [assignmentId]);
    const assignment = assignments;

    if (!assignment) {
      return res.status(404).json({ message: "숙제를 찾을 수 없습니다." });
    }

    // 접근 권한 확인 (숙제 출제자 또는 숙제 대상자)
    if (
      assignment.parent_user_id !== userId &&
      assignment.child_user_id !== userId
    ) {
      return res
        .status(403)
        .json({ message: "숙제 정보를 조회할 권한이 없습니다." });
    }

    // TODO: 숙제 진행 상황 (HomeworkProgress) 요약 정보 추가 가능

    res.status(200).json({ data: assignment });
  } catch (error) {
    console.error("숙제 상세 정보 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 숙제 상세 정보 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// PUT /api/v2/homework/assignments/{assignment_id}
exports.updateHomework = async (req, res) => {
  const userId = req.user.userId; // 요청자는 부모여야 함
  const { assignmentId } = req.params;
  const { reward, status } = req.body; // 수정 가능한 필드 (예: reward, status)

  if (reward === undefined && status === undefined) {
    return res
      .status(400)
      .json({ message: "수정할 내용을 입력해주세요 (예: reward, status)." });
  }
  // TODO: status 값 유효성 검사 (예: 'assigned', 'cancelled' 등 허용값 정의)

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. 숙제 정보 및 소유권 확인
    const [assignments] = await conn.query(
      "SELECT assignment_id, parent_user_id, status FROM HomeworkAssignments WHERE assignment_id = ?",
      [assignmentId]
    );
    const assignment = assignments;

    if (!assignment) {
      await conn.rollback();
      return res.status(404).json({ message: "숙제를 찾을 수 없습니다." });
    }
    if (assignment.parent_user_id !== userId) {
      await conn.rollback();
      return res
        .status(403)
        .json({ message: "숙제를 수정할 권한이 없습니다." });
    }

    // TODO: 숙제 상태(assignment.status)에 따라 수정 가능 여부 제한 (예: 'assigned' 상태일 때만 수정 가능)
    /*
    if (assignment.status !== 'assigned') {
      await conn.rollback();
      return res.status(400).json({ message: `이미 시작되었거나 완료된 숙제(${assignment.status})는 수정할 수 없습니다.` });
    }
    */

    // 2. 업데이트할 필드 동적 생성
    const updates = [];
    const params = [];
    if (reward !== undefined) {
      updates.push("reward = ?");
      params.push(reward);
    }
    if (status) {
      updates.push("status = ?");
      params.push(status);
    }
    params.push(assignmentId); // WHERE 절 ID

    // 3. 업데이트 쿼리 실행
    const updateQuery = `UPDATE HomeworkAssignments SET ${updates.join(
      ", "
    )} WHERE assignment_id = ?`;
    const [result] = await conn.query(updateQuery, params);

    if (result.affectedRows === 0) {
      await conn.rollback(); // 동시성 문제 등으로 업데이트 안될 수 있음
      return res
        .status(409)
        .json({ message: "숙제 정보 업데이트에 실패했습니다." });
    }

    await conn.commit();
    console.log(`Homework assignment updated: assignmentId=${assignmentId}`);
    res
      .status(200)
      .json({ message: "숙제 정보가 성공적으로 업데이트되었습니다." });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("숙제 정보 업데이트 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 숙제 정보 업데이트에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// DELETE /api/v2/homework/assignments/{assignment_id}
exports.deleteHomework = async (req, res) => {
  const userId = req.user.userId; // 요청자는 부모여야 함
  const { assignmentId } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. 숙제 정보 및 소유권 확인
    const [assignments] = await conn.query(
      "SELECT assignment_id, parent_user_id, status FROM HomeworkAssignments WHERE assignment_id = ?",
      [assignmentId]
    );
    const assignment = assignments;

    if (!assignment) {
      await conn.rollback();
      return res.status(404).json({ message: "숙제를 찾을 수 없습니다." });
    }
    if (assignment.parent_user_id !== userId) {
      await conn.rollback();
      return res
        .status(403)
        .json({ message: "숙제를 삭제할 권한이 없습니다." });
    }

    // TODO: 숙제 상태(assignment.status)에 따라 삭제 가능 여부 제한 (예: 'assigned' 상태일 때만 삭제 가능)
    // TODO: 또는 관련 HomeworkProgress 레코드도 함께 삭제 (CASCADE 제약조건 설정 또는 직접 삭제)

    // 2. HomeworkProgress 레코드 삭제 (우선 직접 삭제)
    await conn.query("DELETE FROM HomeworkProgress WHERE assignment_id = ?", [
      assignmentId,
    ]);

    // 3. HomeworkAssignments 레코드 삭제
    const [result] = await conn.query(
      "DELETE FROM HomeworkAssignments WHERE assignment_id = ?",
      [assignmentId]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "숙제 삭제에 실패했습니다." });
    }

    await conn.commit();
    console.log(`Homework assignment deleted: assignmentId=${assignmentId}`);
    res.status(200).json({ message: "숙제가 성공적으로 삭제되었습니다." });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("숙제 삭제 중 오류 발생:", error);
    res.status(500).json({ message: "서버 오류로 숙제 삭제에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/v2/homework/progress
exports.submitHomeworkProgress = async (req, res) => {
  const childUserId = req.user.userId; // 진행 상황 제출자는 자녀
  const { assignmentId, termId, status } = req.body; // status: 'correct' or 'incorrect'

  // 1. 입력값 유효성 검사
  if (assignmentId === undefined || termId === undefined || !status) {
    return res.status(400).json({
      message: "assignmentId, termId, status는 필수 입력 항목입니다.",
    });
  }
  if (!["correct", "incorrect"].includes(status)) {
    return res.status(400).json({
      message: "status는 'correct' 또는 'incorrect' 값이어야 합니다.",
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 2. 숙제 정보 및 제출 자격 확인
    const [assignments] = await conn.query(
      "SELECT assignment_id, child_user_id, dataset_id, status as assignment_status, reward FROM HomeworkAssignments WHERE assignment_id = ?",
      [assignmentId]
    );
    const assignment = assignments;

    if (!assignment) {
      await conn.rollback();
      return res.status(404).json({ message: "해당 숙제를 찾을 수 없습니다." });
    }
    if (assignment.child_user_id !== childUserId) {
      await conn.rollback();
      return res.status(403).json({
        message: "이 숙제에 대한 진행 상황을 제출할 권한이 없습니다.",
      });
    }
    if (assignment.assignment_status === "completed") {
      await conn.rollback();
      return res.status(400).json({ message: "이미 완료된 숙제입니다." });
    }
    // 숙제가 'assigned' 상태면 'in_progress'로 변경 (최초 제출 시)
    if (assignment.assignment_status === "assigned") {
      await conn.query(
        "UPDATE HomeworkAssignments SET status = 'in_progress' WHERE assignment_id = ?",
        [assignmentId]
      );
      console.log(
        `Homework assignment ${assignmentId} status changed to in_progress.`
      );
    }

    // 3. HomeworkProgress 테이블에 기록 (같은 termId에 대한 제출이 여러번 올 수 있으므로 UPSERT 사용)
    const progressQuery = `
      INSERT INTO HomeworkProgress (assignment_id, term_id, status)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE status = VALUES(status), submitted_at = NOW()
    `;
    await conn.query(progressQuery, [assignmentId, termId, status]);
    console.log(
      `Homework progress submitted: assignmentId=${assignmentId}, termId=${termId}, status=${status}`
    );

    let rewardEarned = 0;
    // 4. (선택 사항) 숙제 완료 여부 확인 및 상태 업데이트
    // 4.1. 해당 데이터셋의 총 단어(Term) 수 조회 (개선: Concept 기준으로 카운트해야 할 수도 있음)
    const [termCountRows] = await conn.query(
      `SELECT COUNT(DISTINCT t.term_id) as totalTerms
         FROM DatasetConcepts dc
         JOIN Terms t ON dc.concept_id = t.concept_id
         WHERE dc.dataset_id = ?`,
      [assignment.dataset_id]
    );
    const totalTerms = termCountRows.totalTerms || 0;

    // 4.2. 해당 숙제에서 맞힌 단어(Term) 수 조회
    const [correctCountRows] = await conn.query(
      "SELECT COUNT(*) as correctCount FROM HomeworkProgress WHERE assignment_id = ? AND status = 'correct'",
      [assignmentId]
    );
    const correctCount = correctCountRows.correctCount || 0;

    // 4.3. 모든 단어를 맞혔으면 숙제 완료 처리
    if (totalTerms > 0 && correctCount >= totalTerms) {
      await conn.query(
        "UPDATE HomeworkAssignments SET status = 'completed' WHERE assignment_id = ?",
        [assignmentId]
      );
      console.log(`Homework assignment ${assignmentId} completed!`);

      // 5. (선택 사항) 보상(마일리지) 지급 (숙제 완료 시점에 지급)
      if (assignment.reward > 0) {
        // Users 테이블에 mileage 컬럼이 있다고 가정
        await conn.query(
          "UPDATE Users SET mileage = mileage + ? WHERE user_id = ?",
          [assignment.reward, childUserId]
        );
        rewardEarned = assignment.reward;
        console.log(
          `Awarded ${rewardEarned} mileage to user ${childUserId} for completing homework ${assignmentId}`
        );
        // TODO: 마일리지 지급 알림 생성
      }
    }

    await conn.commit();
    res.status(200).json({
      message: "숙제 진행 상황이 성공적으로 제출되었습니다.",
      rewardEarned: rewardEarned,
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("숙제 진행 상황 제출 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 숙제 진행 상황 제출에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/homework/assignments/{assignment_id}/progress
exports.getHomeworkProgress = async (req, res) => {
  const userId = req.user.userId; // 요청자는 부모여야 함
  const { assignmentId } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();

    // 1. 숙제 정보 및 요청자 권한(부모) 확인
    const [assignments] = await conn.query(
      "SELECT assignment_id, parent_user_id, child_user_id FROM HomeworkAssignments WHERE assignment_id = ?",
      [assignmentId]
    );
    const assignment = assignments;

    if (!assignment) {
      return res.status(404).json({ message: "해당 숙제를 찾을 수 없습니다." });
    }
    if (assignment.parent_user_id !== userId) {
      return res
        .status(403)
        .json({ message: "이 숙제의 진행 상황을 조회할 권한이 없습니다." });
    }

    // 2. 해당 숙제의 모든 진행 상황 조회 (Term 정보 포함)
    const query = `
      SELECT hp.term_id, hp.status, hp.submitted_at, t.text as term_text, t.language_code as term_language
      FROM HomeworkProgress hp
      JOIN Terms t ON hp.term_id = t.term_id
      WHERE hp.assignment_id = ?
      ORDER BY hp.submitted_at DESC
    `;
    const [progressList] = await conn.query(query, [assignmentId]);

    // TODO: 데이터셋의 전체 단어 목록과 비교하여 아직 풀지 않은 단어 정보도 함께 제공하면 더 유용할 수 있음

    res.status(200).json({ data: progressList });
  } catch (error) {
    console.error("숙제 진행 상황 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 숙제 진행 상황 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};
