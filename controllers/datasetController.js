const { pool } = require("../server");

// POST /api/v2/datasets
exports.createDataset = async (req, res) => {
  const ownerUserId = req.user.userId;
  const userRole = req.user.role; // 인증 미들웨어에서 role 정보가 포함되어 있다고 가정
  const { name, source_language_code, target_language_code } = req.body;

  // 1. 권한 확인 (예: 'parent' 또는 'admin' 역할만 생성 가능)
  // TODO: 정확한 역할 이름 확인 및 적용 필요
  if (!["parent", "admin"].includes(userRole)) {
    return res
      .status(403)
      .json({ message: "데이터셋을 생성할 권한이 없습니다." }); // 403 Forbidden
  }

  // 2. 입력값 유효성 검사
  if (!name || !source_language_code || !target_language_code) {
    return res.status(400).json({
      message: "데이터셋 이름, 원본 언어 코드, 대상 언어 코드는 필수입니다.",
    });
  }
  // TODO: language_code 형식 검증 (e.g., 'en', 'ko')

  let conn;
  try {
    conn = await pool.getConnection();

    // 3. 데이터셋 생성
    const [result] = await conn.query(
      "INSERT INTO Datasets (name, owner_user_id, source_language_code, target_language_code) VALUES (?, ?, ?, ?)",
      [name, ownerUserId, source_language_code, target_language_code]
    );

    const newDatasetId = result.insertId;
    console.log(
      `Dataset created: datasetId=${newDatasetId}, name=${name}, ownerId=${ownerUserId}`
    );

    // 4. 성공 응답 (생성된 데이터셋 ID 포함)
    res.status(201).json({
      message: "데이터셋이 성공적으로 생성되었습니다.",
      datasetId: newDatasetId.toString(),
    });
  } catch (error) {
    console.error("데이터셋 생성 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 데이터셋 생성에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/datasets
exports.getAllDatasets = async (req, res) => {
  // TODO: 필터링 (내가 만든 것, 공식, 공개, 언어쌍 등), 페이지네이션 구현
  let conn;
  try {
    conn = await pool.getConnection();

    // 우선 모든 데이터셋 조회 (소유자 닉네임 포함)
    const [datasets] = await conn.query(
      `SELECT d.dataset_id, d.name, d.source_language_code, d.target_language_code, d.owner_user_id, u.nickname as owner_nickname
      FROM Datasets d
      JOIN Users u ON d.owner_user_id = u.user_id
      ORDER BY d.created_at DESC` // 최신순 정렬 (created_at 컬럼 가정)
    );

    res.status(200).json({ data: datasets });
  } catch (error) {
    console.error("데이터셋 목록 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 데이터셋 목록 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/datasets/{dataset_id}
exports.getDatasetById = async (req, res) => {
  const { datasetId } = req.params;
  // TODO: 데이터셋에 포함된 Concepts/Terms/Hints 정보 함께 조회 (JOIN 또는 별도 쿼리)
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. 데이터셋 기본 정보 조회
    const [datasets] = await conn.query(
      `SELECT d.dataset_id, d.name, d.source_language_code, d.target_language_code, d.owner_user_id, u.nickname as owner_nickname, d.created_at
       FROM Datasets d
       JOIN Users u ON d.owner_user_id = u.user_id
       WHERE d.dataset_id = ?`,
      [datasetId]
    );
    const dataset = datasets; // mariadb v3+

    if (!dataset) {
      return res.status(404).json({ message: "데이터셋을 찾을 수 없습니다." });
    }

    // TODO: 2. 이 데이터셋에 속한 Concepts, Terms, Hints 정보 조회 로직 추가

    res.status(200).json({ data: dataset }); // 우선 기본 정보만 반환
  } catch (error) {
    console.error("데이터셋 상세 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 데이터셋 상세 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// PUT /api/v2/datasets/{dataset_id}
exports.updateDataset = async (req, res) => {
  const { datasetId } = req.params;
  const userId = req.user.userId;
  const { name, source_language_code, target_language_code } = req.body; // 업데이트할 필드

  // 입력값 유효성 검사 (업데이트할 필드 중 하나라도 있어야 함)
  if (!name && !source_language_code && !target_language_code) {
    return res
      .status(400)
      .json({ message: "업데이트할 내용을 하나 이상 입력해주세요." });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // 1. 데이터셋 소유권 확인
    const [datasets] = await conn.query(
      "SELECT owner_user_id FROM Datasets WHERE dataset_id = ?",
      [datasetId]
    );
    const dataset = datasets;

    if (!dataset) {
      return res.status(404).json({ message: "데이터셋을 찾을 수 없습니다." });
    }
    if (dataset.owner_user_id !== userId) {
      // TODO: 관리자(admin) 역할도 수정 가능하게 하려면 조건 추가
      return res
        .status(403)
        .json({ message: "데이터셋을 수정할 권한이 없습니다." });
    }

    // 2. 업데이트할 필드 동적 생성
    const updates = [];
    const params = [];
    if (name) {
      updates.push("name = ?");
      params.push(name);
    }
    if (source_language_code) {
      updates.push("source_language_code = ?");
      params.push(source_language_code);
    }
    if (target_language_code) {
      updates.push("target_language_code = ?");
      params.push(target_language_code);
    }
    params.push(datasetId); // WHERE 절을 위한 ID

    // 3. 데이터셋 업데이트 쿼리 실행
    const updateQuery = `UPDATE Datasets SET ${updates.join(
      ", "
    )} WHERE dataset_id = ?`;
    const [result] = await conn.query(updateQuery, params);

    if (result.affectedRows === 0) {
      // 업데이트가 되지 않은 경우 (보통 datasetId가 잘못된 경우에 해당)
      // 소유권 체크에서 이미 걸러졌으므로 404보다는 다른 상태 코드가 적절할 수 있음
      return res
        .status(404)
        .json({ message: "데이터셋 업데이트에 실패했습니다." });
    }

    console.log(`Dataset updated: datasetId=${datasetId}`);
    res
      .status(200)
      .json({ message: "데이터셋 정보가 성공적으로 업데이트되었습니다." });
  } catch (error) {
    console.error("데이터셋 업데이트 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 데이터셋 업데이트에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// DELETE /api/v2/datasets/{dataset_id}
exports.deleteDataset = async (req, res) => {
  const { datasetId } = req.params;
  const userId = req.user.userId;

  let conn;
  try {
    conn = await pool.getConnection();

    // 1. 데이터셋 소유권 확인
    const [datasets] = await conn.query(
      "SELECT owner_user_id FROM Datasets WHERE dataset_id = ?",
      [datasetId]
    );
    const dataset = datasets;

    if (!dataset) {
      return res.status(404).json({ message: "데이터셋을 찾을 수 없습니다." });
    }
    if (dataset.owner_user_id !== userId) {
      // TODO: 관리자(admin) 역할도 삭제 가능하게 하려면 조건 추가
      return res
        .status(403)
        .json({ message: "데이터셋을 삭제할 권한이 없습니다." });
    }

    // TODO: 2. 이 데이터셋을 사용하는 HomeworkAssignments 등이 있는지 확인하고 삭제 막기 or 같이 삭제 (CASCADE)
    // 여기서는 우선 관련 데이터 확인 없이 삭제 진행

    // 3. DatasetConcepts 테이블에서 관련 레코드 삭제
    await conn.query("DELETE FROM DatasetConcepts WHERE dataset_id = ?", [
      datasetId,
    ]);

    // 4. Datasets 테이블에서 데이터셋 삭제
    const [result] = await conn.query(
      "DELETE FROM Datasets WHERE dataset_id = ?",
      [datasetId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "데이터셋 삭제에 실패했습니다." });
    }

    console.log(`Dataset deleted: datasetId=${datasetId}`);
    res.status(200).json({ message: "데이터셋이 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error("데이터셋 삭제 중 오류 발생:", error);
    // Foreign key 제약 조건 위반 등 에러 처리 필요
    res
      .status(500)
      .json({ message: "서버 오류로 데이터셋 삭제에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/v2/datasets/{dataset_id}/concepts
exports.addConceptToDataset = async (req, res) => {
  const { datasetId } = req.params;
  const { conceptId } = req.body;
  const userId = req.user.userId;

  if (!conceptId) {
    return res.status(400).json({ message: "추가할 Concept ID가 필요합니다." });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction(); // 트랜잭션 시작

    // 1. 데이터셋 소유권 확인 (또는 관리자)
    const [datasets] = await conn.query(
      "SELECT owner_user_id FROM Datasets WHERE dataset_id = ?",
      [datasetId]
    );
    const dataset = datasets;
    if (!dataset || dataset.owner_user_id !== userId) {
      // TODO: 관리자 역할 확인 추가
      await conn.rollback();
      return res
        .status(403)
        .json({ message: "데이터셋에 단어를 추가할 권한이 없습니다." });
    }

    // 2. Concept 존재 확인
    const [concepts] = await conn.query(
      "SELECT concept_id FROM Concepts WHERE concept_id = ?",
      [conceptId]
    );
    if (!concepts) {
      await conn.rollback();
      return res
        .status(404)
        .json({ message: "존재하지 않는 Concept ID입니다." });
    }

    // 3. 이미 존재하는지 확인 (INSERT IGNORE 사용으로 대체 가능)
    const [existing] = await conn.query(
      "SELECT * FROM DatasetConcepts WHERE dataset_id = ? AND concept_id = ?",
      [datasetId, conceptId]
    );
    if (existing) {
      await conn.rollback();
      return res
        .status(409)
        .json({ message: "해당 단어가 이미 데이터셋에 존재합니다." });
    }

    // 4. DatasetConcepts 테이블에 추가
    await conn.query(
      "INSERT INTO DatasetConcepts (dataset_id, concept_id) VALUES (?, ?)",
      [datasetId, conceptId]
    );

    await conn.commit(); // 트랜잭션 커밋
    console.log(`Concept ${conceptId} added to dataset ${datasetId}`);
    res
      .status(201)
      .json({ message: "데이터셋에 단어를 성공적으로 추가했습니다." });
  } catch (error) {
    if (conn) await conn.rollback(); // 오류 발생 시 롤백
    console.error("데이터셋에 단어 추가 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 데이터셋에 단어 추가를 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// DELETE /api/v2/datasets/{dataset_id}/concepts/{concept_id}
exports.removeConceptFromDataset = async (req, res) => {
  const { datasetId, conceptId } = req.params;
  const userId = req.user.userId;

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. 데이터셋 소유권 확인 (또는 관리자)
    const [datasets] = await conn.query(
      "SELECT owner_user_id FROM Datasets WHERE dataset_id = ?",
      [datasetId]
    );
    const dataset = datasets;
    if (!dataset || dataset.owner_user_id !== userId) {
      // TODO: 관리자 역할 확인 추가
      await conn.rollback();
      return res
        .status(403)
        .json({ message: "데이터셋에서 단어를 제거할 권한이 없습니다." });
    }

    // 2. DatasetConcepts 테이블에서 삭제
    const [result] = await conn.query(
      "DELETE FROM DatasetConcepts WHERE dataset_id = ? AND concept_id = ?",
      [datasetId, conceptId]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res
        .status(404)
        .json({ message: "데이터셋에 해당 단어가 존재하지 않습니다." });
    }

    await conn.commit();
    console.log(`Concept ${conceptId} removed from dataset ${datasetId}`);
    res
      .status(200)
      .json({ message: "데이터셋에서 단어를 성공적으로 제거했습니다." });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("데이터셋에서 단어 제거 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 데이터셋에서 단어 제거를 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/v2/datasets/{dataset_id}/terms
exports.addCustomWordToDataset = async (req, res) => {
  const { datasetId } = req.params;
  const userId = req.user.userId;
  const { conceptId: existingConceptId, imageUrl, terms } = req.body;

  // 1. 입력값 유효성 검사
  if (!terms || !Array.isArray(terms) || terms.length === 0) {
    return res
      .status(400)
      .json({ message: "추가할 용어(terms) 정보가 필요합니다." });
  }
  if (!existingConceptId && !imageUrl) {
    return res.status(400).json({
      message:
        "기존 Concept ID 또는 새 Concept을 위한 Image URL 중 하나는 필수입니다.",
    });
  }
  if (existingConceptId && imageUrl) {
    return res.status(400).json({
      message:
        "기존 Concept ID와 새 Concept Image URL을 동시에 제공할 수 없습니다.",
    });
  }
  // TODO: terms 배열 내부 구조 유효성 검사 강화 (language_code, text 필수 등)

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction(); // 트랜잭션 시작

    // 2. 데이터셋 소유권 확인
    const [datasets] = await conn.query(
      "SELECT owner_user_id FROM Datasets WHERE dataset_id = ?",
      [datasetId]
    );
    const dataset = datasets;
    if (!dataset || dataset.owner_user_id !== userId) {
      // TODO: 관리자 역할 확인 추가
      await conn.rollback();
      return res
        .status(403)
        .json({ message: "데이터셋에 단어를 추가할 권한이 없습니다." });
    }

    let conceptIdToUse;

    // 3. Concept 결정 또는 생성
    if (existingConceptId) {
      // 기존 Concept 사용
      const [concepts] = await conn.query(
        "SELECT concept_id FROM Concepts WHERE concept_id = ?",
        [existingConceptId]
      );
      if (!concepts) {
        await conn.rollback();
        return res.status(404).json({
          message: `Concept ID ${existingConceptId}를 찾을 수 없습니다.`,
        });
      }
      conceptIdToUse = existingConceptId;
    } else {
      // 새 Concept 생성
      const [conceptResult] = await conn.query(
        "INSERT INTO Concepts (image_url, created_by) VALUES (?, ?)",
        [imageUrl, userId] // created_by는 현재 사용자로 설정
      );
      conceptIdToUse = conceptResult.insertId;
      console.log(
        `New concept created: conceptId=${conceptIdToUse}, imageUrl=${imageUrl}`
      );
    }

    // 4. DatasetConcepts 에 연결 (이미 존재하면 무시)
    await conn.query(
      "INSERT IGNORE INTO DatasetConcepts (dataset_id, concept_id) VALUES (?, ?)",
      [datasetId, conceptIdToUse]
    );
    console.log(`Concept ${conceptIdToUse} linked to dataset ${datasetId}`);

    // 5. Terms 및 Hints 삽입
    for (const term of terms) {
      if (!term.language_code || !term.text) {
        // 간단 유효성 검사 (개선 필요)
        throw new Error(
          `Term 객체에 language_code와 text는 필수입니다: ${JSON.stringify(
            term
          )}`
        );
      }

      // Term 삽입
      const [termResult] = await conn.query(
        "INSERT INTO Terms (concept_id, language_code, text, audio_ref) VALUES (?, ?, ?, ?)",
        [conceptIdToUse, term.language_code, term.text, term.audio_ref || null]
      );
      const newTermId = termResult.insertId;
      console.log(
        `Term added: termId=${newTermId}, lang=${term.language_code}, text=${term.text}`
      );

      // Hints 삽입 (존재하는 경우)
      if (term.hints && Array.isArray(term.hints)) {
        for (const hint of term.hints) {
          if (!hint.hint_type || !hint.hint_content || !hint.language_code) {
            throw new Error(
              `Hint 객체에 hint_type, hint_content, language_code는 필수입니다: ${JSON.stringify(
                hint
              )}`
            );
          }
          await conn.query(
            "INSERT INTO Hints (term_id, hint_type, hint_content, language_code) VALUES (?, ?, ?, ?)",
            [newTermId, hint.hint_type, hint.hint_content, hint.language_code]
          );
          console.log(
            `Hint added for term ${newTermId}: type=${hint.hint_type}`
          );
        }
      }
    }

    await conn.commit(); // 모든 작업 성공 시 커밋

    res.status(201).json({
      message: "단어(용어 및 힌트)가 성공적으로 추가되었습니다.",
      conceptId: conceptIdToUse.toString(),
    });
  } catch (error) {
    if (conn) await conn.rollback(); // 오류 발생 시 롤백
    console.error("커스텀 단어 추가 중 오류 발생:", error);
    // 에러 종류에 따라 더 구체적인 상태 코드 반환 가능 (e.g., 유효성 검사 실패 시 400)
    res.status(500).json({
      message: `서버 오류로 단어 추가에 실패했습니다: ${error.message}`,
    });
  } finally {
    if (conn) conn.release();
  }
};
