// controllers/userController.js
const { pool } = require("../server"); // pool 임포트 추가

// GET /api/v2/users/me
exports.getMyProfile = async (req, res) => {
  // 인증 미들웨어를 통과하면 req.user 객체에 사용자 정보가 담겨 있음
  const userInfo = req.user;

  // password_hash와 같은 민감 정보는 제외하고 필요한 정보만 반환
  // (실제로는 DB에서 최신 정보를 조회하는 것이 더 좋을 수 있음)
  const profileData = {
    userId: userInfo.userId,
    email: userInfo.email,
    nickname: userInfo.nickname,
    role: userInfo.role,
    // 필요에 따라 DB에서 settings, mileage 등을 추가 조회
  };

  res.status(200).json({ data: profileData });
};

// PUT /api/v2/users/me
exports.updateMyProfile = async (req, res) => {
  const userId = req.user.userId; // 인증된 사용자 ID
  const { nickname } = req.body; // 수정할 닉네임 (다른 필드도 추가 가능)

  // 1. 입력값 유효성 검사
  if (!nickname || nickname.trim() === "") {
    return res.status(400).json({ message: "닉네임을 입력해주세요." });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // 2. 닉네임 업데이트 (다른 필드 업데이트 쿼리 추가 가능)
    const [result] = await conn.query(
      "UPDATE Users SET nickname = ? WHERE user_id = ?",
      [nickname.trim(), userId]
    );

    if (result.affectedRows === 0) {
      // 해당 유저가 없는 경우 (일반적으로는 발생하기 어려움)
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    console.log(
      `User profile updated: userId=${userId}, newNickname=${nickname.trim()}`
    );

    // 3. 성공 응답 (업데이트된 닉네임 포함 또는 성공 메시지만)
    res.status(200).json({
      message: "프로필 정보가 성공적으로 업데이트되었습니다.",
      nickname: nickname.trim(),
    });
  } catch (error) {
    console.error("프로필 업데이트 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 프로필 업데이트에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/users/me/settings
exports.getMySettings = async (req, res) => {
  const userId = req.user.userId;
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT settings FROM Users WHERE user_id = ?",
      [userId]
    );
    const user = rows; // mariadb v3+ 는 객체 반환

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    let settings = {};
    try {
      // DB의 settings 컬럼이 NULL이거나 비어있을 수 있음
      settings = user.settings ? JSON.parse(user.settings) : {};
    } catch (parseError) {
      console.error(
        `Error parsing settings JSON for user ${userId}:`,
        parseError
      );
      // 파싱 오류 시 빈 객체 또는 기본 설정 반환 고려
    }

    res.status(200).json({ data: settings });
  } catch (error) {
    console.error("설정 조회 중 오류 발생:", error);
    res.status(500).json({ message: "서버 오류로 설정 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// PUT /api/v2/users/me/settings
exports.updateMySettings = async (req, res) => {
  const userId = req.user.userId;
  const newSettings = req.body; // 요청 본문 전체를 새 설정으로 간주

  // 1. 입력값 유효성 검사 (간단히 객체인지 확인)
  if (typeof newSettings !== "object" || newSettings === null) {
    return res.status(400).json({ message: "잘못된 설정 형식입니다." });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // TODO: 기존 설정을 불러와서 병합할지, 전체를 덮어쓸지 결정 필요
    // 여기서는 전체 덮어쓰기 방식으로 구현
    const settingsJson = JSON.stringify(newSettings);

    const [result] = await conn.query(
      "UPDATE Users SET settings = ? WHERE user_id = ?",
      [settingsJson, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    console.log(`User settings updated: userId=${userId}`);

    // 성공 응답 (업데이트된 설정 반환)
    res.status(200).json({
      message: "설정이 성공적으로 업데이트되었습니다.",
      data: newSettings,
    });
  } catch (error) {
    console.error("설정 업데이트 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 설정 업데이트에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/v2/users/me/relations/request
exports.requestRelation = async (req, res) => {
  const parentUserId = req.user.userId; // 요청자는 부모
  const { childEmail } = req.body; // 요청 대상 자녀의 이메일

  if (!childEmail) {
    return res.status(400).json({ message: "자녀의 이메일을 입력해주세요." });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // 1. 자녀 이메일로 사용자 ID 찾기
    const [childUsers] = await conn.query(
      "SELECT user_id, email FROM Users WHERE email = ?",
      [childEmail]
    );
    const childUser = childUsers;

    if (!childUser) {
      return res
        .status(404)
        .json({ message: "해당 이메일을 가진 사용자를 찾을 수 없습니다." });
    }
    const childUserId = childUser.user_id;

    // 2. 자기 자신에게 요청 불가
    if (parentUserId === childUserId) {
      return res
        .status(400)
        .json({ message: "자기 자신에게 관계를 요청할 수 없습니다." });
    }

    // 3. 이미 관계가 존재하는지 확인 (pending 또는 approved 상태)
    const [existingRelations] = await conn.query(
      "SELECT relation_id FROM UserRelations WHERE ((parent_user_id = ? AND child_user_id = ?) OR (parent_user_id = ? AND child_user_id = ?)) AND status IN ('pending', 'approved')",
      [parentUserId, childUserId, childUserId, parentUserId] // 양방향 확인
    );

    if (existingRelations) {
      return res
        .status(409)
        .json({ message: "이미 관계 요청이 존재하거나 승인된 관계입니다." }); // 409 Conflict
    }

    // 4. 관계 요청 생성 (status: 'pending')
    const [result] = await conn.query(
      "INSERT INTO UserRelations (parent_user_id, child_user_id, status) VALUES (?, ?, ?)",
      [parentUserId, childUserId, "pending"]
    );

    console.log(
      `Relation request created: relationId=${result.insertId}, parentId=${parentUserId}, childId=${childUserId}`
    );

    // TODO: 자녀에게 알림 생성 (Notifications 테이블)

    // 5. 성공 응답
    res.status(201).json({
      message: "관계 요청을 성공적으로 보냈습니다.",
      relationId: result.insertId.toString(),
    });
  } catch (error) {
    console.error("관계 요청 중 오류 발생:", error);
    res.status(500).json({ message: "서버 오류로 관계 요청에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/users/me/relations
exports.getMyRelations = async (req, res) => {
  const userId = req.user.userId;
  let conn;
  try {
    conn = await pool.getConnection();

    // 내가 부모인 관계 (자녀 정보 포함)
    const [childrenRows] = await conn.query(
      `SELECT ur.relation_id, ur.status, u.user_id as child_id, u.nickname as child_nickname, u.email as child_email
       FROM UserRelations ur
       JOIN Users u ON ur.child_user_id = u.user_id
       WHERE ur.parent_user_id = ?`,
      [userId]
    );
    const childrenRelations = childrenRows.map((r) => ({
      ...r,
      relation_id: r.relation_id ? r.relation_id.toString() : undefined,
      child_id: r.child_id ? r.child_id.toString() : undefined,
    }));

    // 내가 자녀인 관계 (부모 정보 포함)
    const [parentRows] = await conn.query(
      `SELECT ur.relation_id, ur.status, u.user_id as parent_id, u.nickname as parent_nickname, u.email as parent_email
       FROM UserRelations ur
       JOIN Users u ON ur.parent_user_id = u.user_id
       WHERE ur.child_user_id = ?`,
      [userId]
    );
    const parentRelations = parentRows.map((r) => ({
      ...r,
      relation_id: r.relation_id ? r.relation_id.toString() : undefined,
      parent_id: r.parent_id ? r.parent_id.toString() : undefined,
    }));

    // 결과 형식화
    const pendingReceived = parentRelations
      .filter((r) => r.status === "pending")
      .map((r) => ({
        // 부모 정보만 포함 (요청자 정보)
        relation_id: r.relation_id,
        status: r.status,
        requester_id: r.parent_id,
        requester_nickname: r.parent_nickname,
        requester_email: r.parent_email,
      }));

    const pendingSent = childrenRelations
      .filter((r) => r.status === "pending")
      .map((r) => ({
        // 자녀 정보만 포함 (요청 대상 정보)
        relation_id: r.relation_id,
        status: r.status,
        addressee_id: r.child_id,
        addressee_nickname: r.child_nickname,
        addressee_email: r.child_email,
      }));

    const approvedParents = parentRelations
      .filter((r) => r.status === "approved")
      .map((r) => ({
        // 부모 정보
        relation_id: r.relation_id,
        status: r.status,
        parent_id: r.parent_id,
        parent_nickname: r.parent_nickname,
        parent_email: r.parent_email,
      }));

    const approvedChildren = childrenRelations
      .filter((r) => r.status === "approved")
      .map((r) => ({
        // 자녀 정보
        relation_id: r.relation_id,
        status: r.status,
        child_id: r.child_id,
        child_nickname: r.child_nickname,
        child_email: r.child_email,
      }));

    res.status(200).json({
      data: {
        pendingReceived,
        pendingSent,
        parents: approvedParents,
        children: approvedChildren,
      },
    });
  } catch (error) {
    console.error("관계 목록 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 관계 목록 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// PUT /api/v2/users/me/relations/{relation_id}
exports.handleRelationRequest = async (req, res) => {
  const childUserId = req.user.userId; // 요청 처리자는 자녀
  const relationId = req.params.relationId;
  const { status } = req.body; // 'approved' 또는 'rejected'

  // 1. 유효한 상태 값인지 확인
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({
      message: "잘못된 상태 값입니다. 'approved' 또는 'rejected'만 가능합니다.",
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // 2. 해당 관계 요청이 현재 사용자(자녀)에게 온 보류 중인 요청인지 확인
    const [relations] = await conn.query(
      "SELECT relation_id, parent_user_id, status FROM UserRelations WHERE relation_id = ? AND child_user_id = ?",
      [relationId, childUserId]
    );
    const relation = relations;

    if (!relation) {
      return res.status(404).json({
        message: "해당 관계 요청을 찾을 수 없거나 처리할 권한이 없습니다.",
      });
    }

    if (relation.status !== "pending") {
      return res.status(400).json({
        message: `이미 처리된 요청입니다 (상태: ${relation.status}).`,
      });
    }

    // 3. 상태 업데이트
    const [result] = await conn.query(
      "UPDATE UserRelations SET status = ? WHERE relation_id = ?",
      [status, relationId]
    );

    if (result.affectedRows === 0) {
      // 업데이트 실패 (동시에 다른 요청으로 변경되었을 수 있음)
      return res.status(409).json({
        message: "관계 상태 업데이트에 실패했습니다. 다시 시도해주세요.",
      });
    }

    console.log(
      `Relation request handled: relationId=${relationId}, childId=${childUserId}, newStatus=${status}`
    );

    // TODO: 부모에게 알림 생성 (Notifications 테이블) - 요청 결과 알림

    // 4. 성공 응답
    res.status(200).json({
      message: `관계 요청을 성공적으로 ${
        status === "approved" ? "수락" : "거절"
      }했습니다.`,
    });
  } catch (error) {
    console.error("관계 요청 처리 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 관계 요청 처리에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/users/me/stats?lang_pair={pair}
exports.getUserStats = async (req, res) => {
  const userId = req.user.userId;
  const { lang_pair } = req.query;

  if (!lang_pair) {
    return res
      .status(400)
      .json({ message: "lang_pair 쿼리 파라미터가 필요합니다." });
  }
  // TODO: lang_pair 형식 검증 (e.g., "ko-en")

  let conn;
  try {
    conn = await pool.getConnection();
    const [statsRows] = await conn.query(
      "SELECT wins, losses, current_streak, best_streak FROM UserStats WHERE user_id = ? AND language_pair_code = ?",
      [userId, lang_pair]
    );
    const stats = statsRows;

    if (!stats) {
      // 해당 언어쌍 통계가 없으면 기본값 반환
      return res.status(200).json({
        data: {
          language_pair_code: lang_pair,
          wins: 0,
          losses: 0,
          current_streak: 0,
          best_streak: 0,
        },
      });
    }

    res.status(200).json({ data: { language_pair_code: lang_pair, ...stats } });
  } catch (error) {
    console.error("사용자 통계 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 사용자 통계 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};
