const { pool } = require("../server");

// GET /api/v2/game/session?dataset_id={id}
exports.startGameSession = async (req, res) => {
  const { dataset_id } = req.query;
  const userId = req.user.userId; // 세션 시작 사용자 (로그 기록 등에 활용 가능)

  if (!dataset_id) {
    return res
      .status(400)
      .json({ message: "dataset_id 쿼리 파라미터가 필요합니다." });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // 1. 데이터셋 정보 조회 (언어 코드 등 확인 위해)
    const [datasets] = await conn.query(
      "SELECT * FROM Datasets WHERE dataset_id = ?",
      [dataset_id]
    );
    const dataset = datasets;
    if (!dataset) {
      return res.status(404).json({ message: "데이터셋을 찾을 수 없습니다." });
    }
    const processedDatasetInfo = {
      ...dataset,
      dataset_id: dataset.dataset_id
        ? dataset.dataset_id.toString()
        : undefined,
      owner_user_id: dataset.owner_user_id
        ? dataset.owner_user_id.toString()
        : undefined, // owner_user_id도 BigInt일 수 있음
    };

    // 2. 데이터셋에 포함된 단어 정보 (Concepts, Terms, Hints) 한번에 조회
    //    JOIN을 사용하여 관련 정보를 가져옵니다.
    //    결과가 많을 수 있으므로 효율적인 쿼리 작성 및 후처리 필요
    const query = `
      SELECT
        dc.concept_id,
        c.image_url,
        t.term_id, t.language_code, t.text, t.audio_ref,
        h.hint_id, h.hint_type, h.hint_content, h.language_code as hint_language_code
      FROM DatasetConcepts dc
      JOIN Concepts c ON dc.concept_id = c.concept_id
      JOIN Terms t ON c.concept_id = t.concept_id
      LEFT JOIN Hints h ON t.term_id = h.term_id
      WHERE dc.dataset_id = ?
      ORDER BY dc.concept_id, t.term_id, h.hint_id; -- 정렬 중요
    `;
    const [rows] = await conn.query(query, [dataset_id]);

    if (rows.length === 0) {
      return res.status(200).json({
        message: "데이터셋에 포함된 단어가 없습니다.",
        data: { datasetInfo: processedDatasetInfo, concepts: [] },
      });
    }

    // 3. 조회된 결과를 게임 세션에 맞는 구조로 가공
    const conceptsMap = new Map();

    rows.forEach((row) => {
      let concept = conceptsMap.get(
        row.concept_id ? row.concept_id.toString() : undefined
      );
      if (!concept) {
        concept = {
          conceptId: row.concept_id ? row.concept_id.toString() : undefined,
          imageUrl: row.image_url,
          terms: new Map(),
        };
        conceptsMap.set(
          row.concept_id ? row.concept_id.toString() : undefined,
          concept
        );
      }

      let term = concept.terms.get(
        row.term_id ? row.term_id.toString() : undefined
      );
      if (!term) {
        term = {
          termId: row.term_id ? row.term_id.toString() : undefined,
          languageCode: row.language_code,
          text: row.text,
          audioRef: row.audio_ref,
          hints: [],
        };
        concept.terms.set(
          row.term_id ? row.term_id.toString() : undefined,
          term
        );
      }

      // Hint 정보 추가 (hint_id가 NULL이 아닌 경우)
      if (row.hint_id) {
        // 중복 hint 방지 (쿼리 결과에 따라 필요 없을 수 있음)
        if (
          !term.hints.some(
            (h) =>
              h.hintId === (row.hint_id ? row.hint_id.toString() : undefined)
          )
        ) {
          term.hints.push({
            hintId: row.hint_id ? row.hint_id.toString() : undefined,
            type: row.hint_type,
            content: row.hint_content,
            languageCode: row.hint_language_code,
          });
        }
      }
    });

    // 최종 결과 구조화 (Map을 배열로 변환)
    const conceptsData = Array.from(conceptsMap.values()).map((concept) => ({
      ...concept,
      terms: Array.from(concept.terms.values()),
    }));

    // TODO: 게임 로직에 따라 단어 순서 섞기 (Shuffle) 등 추가 처리

    console.log(
      `Game session started for dataset ${dataset_id} by user ${userId}`
    );
    res.status(200).json({
      data: { datasetInfo: processedDatasetInfo, concepts: conceptsData },
    });
  } catch (error) {
    console.error("게임 세션 시작 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 게임 세션 시작에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/game/session/default?grade={grade}
exports.startGameSessionDefault = async (req, res) => {
  const { grade } = req.query;
  const userId = req.user.userId;

  if (!grade) {
    return res
      .status(400)
      .json({ message: "grade 쿼리 파라미터가 필요합니다." });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // 1. 해당 학년에 맞는 공식 데이터셋 ID 찾기 (하나만 찾는다고 가정)
    // TODO: 학년(grade)과 데이터셋 매칭 로직 구체화 필요 (예: 범위, 정확히 일치 등)
    const [defaultDatasets] = await conn.query(
      "SELECT dataset_id FROM Datasets WHERE is_official = true AND recommended_grade = ? LIMIT 1",
      [grade]
    );

    if (!defaultDatasets) {
      return res.status(404).json({
        message: `학년 ${grade}에 해당하는 기본 데이터셋을 찾을 수 없습니다.`,
      });
    }

    const defaultDatasetId = defaultDatasets.dataset_id;

    // 2. 찾은 ID로 기존 startGameSession 로직 재활용 (별도 함수로 분리하는 것이 더 좋음)
    //    startGameSession 함수 내부 로직을 여기에 다시 구현하거나, 내부 호출
    //    여기서는 중복을 피하기 위해 startGameSession 내부 로직과 유사하게 재구현

    const [datasetRows] = await conn.query(
      "SELECT * FROM Datasets WHERE dataset_id = ?",
      [defaultDatasetId]
    );
    const dataset = datasetRows;
    if (!dataset) {
      // 위에서 찾았으므로 이론상 이 경우는 발생하지 않음
      return res
        .status(404)
        .json({ message: "기본 데이터셋 정보를 찾을 수 없습니다." });
    }
    const processedDefaultDatasetInfo = {
      ...dataset,
      dataset_id: dataset.dataset_id
        ? dataset.dataset_id.toString()
        : undefined,
      owner_user_id: dataset.owner_user_id
        ? dataset.owner_user_id.toString()
        : undefined,
    };

    const query = `
      SELECT dc.concept_id, c.image_url, t.term_id, t.language_code, t.text, t.audio_ref, h.hint_id, h.hint_type, h.hint_content, h.language_code as hint_language_code
      FROM DatasetConcepts dc JOIN Concepts c ON dc.concept_id = c.concept_id JOIN Terms t ON c.concept_id = t.concept_id LEFT JOIN Hints h ON t.term_id = h.term_id
      WHERE dc.dataset_id = ? ORDER BY dc.concept_id, t.term_id, h.hint_id;
    `;
    const [rows] = await conn.query(query, [defaultDatasetId]);

    if (rows.length === 0) {
      return res.status(200).json({
        message: "기본 데이터셋에 포함된 단어가 없습니다.",
        data: { datasetInfo: processedDefaultDatasetInfo, concepts: [] },
      });
    }

    const conceptsMap = new Map();
    rows.forEach((row) => {
      let concept = conceptsMap.get(
        row.concept_id ? row.concept_id.toString() : undefined
      );
      if (!concept) {
        concept = {
          conceptId: row.concept_id ? row.concept_id.toString() : undefined,
          imageUrl: row.image_url,
          terms: new Map(),
        };
        conceptsMap.set(
          row.concept_id ? row.concept_id.toString() : undefined,
          concept
        );
      }
      let term = concept.terms.get(
        row.term_id ? row.term_id.toString() : undefined
      );
      if (!term) {
        term = {
          termId: row.term_id ? row.term_id.toString() : undefined,
          languageCode: row.language_code,
          text: row.text,
          audioRef: row.audio_ref,
          hints: [],
        };
        concept.terms.set(
          row.term_id ? row.term_id.toString() : undefined,
          term
        );
      }
      if (
        row.hint_id &&
        !term.hints.some(
          (h) => h.hintId === (row.hint_id ? row.hint_id.toString() : undefined)
        )
      ) {
        term.hints.push({
          hintId: row.hint_id ? row.hint_id.toString() : undefined,
          type: row.hint_type,
          content: row.hint_content,
          languageCode: row.hint_language_code,
        });
      }
    });
    const conceptsData = Array.from(conceptsMap.values()).map((concept) => ({
      ...concept,
      terms: Array.from(concept.terms.values()),
    }));

    console.log(
      `Default game session started for grade ${grade} (dataset ${defaultDatasetId}) by user ${userId}`
    );
    res.status(200).json({
      data: {
        datasetInfo: processedDefaultDatasetInfo,
        concepts: conceptsData,
      },
    });
  } catch (error) {
    console.error("기본 게임 세션 시작 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 기본 게임 세션 시작에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/v2/game/logs
exports.logGameResult = async (req, res) => {
  const userId = req.user.userId;
  // 요청 본문에 필요한 정보: termId, datasetId (언어쌍 확인용), wasCorrect, attempts, source 등
  const { termId, datasetId, wasCorrect, attempts, source } = req.body;

  if (
    termId === undefined ||
    datasetId === undefined ||
    wasCorrect === undefined ||
    attempts === undefined
  ) {
    return res.status(400).json({
      message:
        "termId, datasetId, wasCorrect, attempts는 필수 입력 항목입니다.",
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction(); // 트랜잭션 시작

    // 1. GameLogs 테이블에 로그 기록
    const [logResult] = await conn.query(
      "INSERT INTO GameLogs (user_id, term_id, was_correct, attempts, source, dataset_id) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, termId, wasCorrect, attempts, source || "game", datasetId]
    );
    const newLogId = logResult.insertId;

    // 2. UserStats 업데이트 위한 언어쌍(language_pair_code) 조회
    const [datasets] = await conn.query(
      "SELECT source_language_code, target_language_code FROM Datasets WHERE dataset_id = ?",
      [datasetId]
    );
    if (!datasets) {
      await conn.rollback();
      // datasetId가 유효하지 않으면 로그 기록 전에 오류가 나겠지만, 방어적으로 추가
      return res.status(404).json({
        message: "데이터셋 정보를 찾을 수 없어 통계를 업데이트할 수 없습니다.",
      });
    }
    const langPairCode = `${datasets.source_language_code}-${datasets.target_language_code}`;

    // 3. UserStats 테이블 업데이트 (INSERT ... ON DUPLICATE KEY UPDATE 사용)
    //    wasCorrect 값에 따라 wins/losses 업데이트, 스트릭 로직 추가 필요
    //    best_streak 업데이트 로직: 현재 스트릭과 비교하여 더 크면 업데이트
    //    (스트릭 로직은 단순화하여 wins/losses만 우선 구현)
    const winsIncrement = wasCorrect ? 1 : 0;
    const lossesIncrement = wasCorrect ? 0 : 1;

    const statsUpdateQuery = `
      INSERT INTO UserStats (user_id, language_pair_code, wins, losses, current_streak, best_streak)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        wins = wins + VALUES(wins),
        losses = losses + VALUES(losses),
        current_streak = IF(VALUES(wins) > 0, current_streak + 1, 0), -- 맞으면 스트릭 증가, 틀리면 0
        best_streak = GREATEST(best_streak, current_streak) -- 현재 스트릭과 최고 스트릭 비교 업데이트
    `;
    await conn.query(statsUpdateQuery, [
      userId,
      langPairCode,
      winsIncrement,
      lossesIncrement,
      winsIncrement,
      winsIncrement,
    ]); // 초기값 설정 필요

    await conn.commit(); // 트랜잭션 커밋

    console.log(
      `Game log recorded: logId=${newLogId}, userId=${userId}, termId=${termId}, correct=${wasCorrect}`
    );
    res.status(201).json({
      message: "게임 결과가 성공적으로 기록되었습니다.",
      logId: newLogId.toString(),
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("게임 결과 기록 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 게임 결과 기록에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// TODO: Implement GET /api/v2/game/session/default?grade={grade}
// TODO: Implement POST /api/v2/game/logs
