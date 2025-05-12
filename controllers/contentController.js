const { pool } = require("../server");
const path = require("path"); // 오디오 파일 경로 처리를 위해

// GET /api/v2/concepts/{concept_id}
exports.getConceptById = async (req, res) => {
  const { conceptId } = req.params;
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT concept_id, text_representation, concept_type, language_code, image_url, created_by, created_at, updated_at FROM Concepts WHERE concept_id = ?",
      [conceptId]
    );
    let concept = rows;
    if (!concept) {
      return res.status(404).json({ message: "Concept을 찾을 수 없습니다." });
    }
    concept = {
      ...concept,
      concept_id: concept.concept_id
        ? concept.concept_id.toString()
        : undefined,
      created_by: concept.created_by
        ? concept.created_by.toString()
        : undefined,
    };
    res.status(200).json({ data: concept });
  } catch (error) {
    console.error("Concept 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 Concept 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/terms/{term_id}
exports.getTermById = async (req, res) => {
  const { termId } = req.params;
  let conn;
  try {
    conn = await pool.getConnection();
    // Term 정보와 관련 Hints 정보를 함께 조회
    const termQuery =
      "SELECT term_id, concept_id, language_code, text, term_type, audio_url, image_url, created_at, updated_at FROM Terms WHERE term_id = ?";
    const hintQuery =
      "SELECT hint_id, term_id, hint_text, hint_type, created_at FROM Hints WHERE term_id = ?";

    const [termRows] = await conn.query(termQuery, [termId]);
    let term = termRows;

    if (!term) {
      return res.status(404).json({ message: "Term을 찾을 수 없습니다." });
    }

    const [hintRows] = await conn.query(hintQuery, [termId]);
    const hints = hintRows.map((h) => ({
      ...h,
      hint_id: h.hint_id ? h.hint_id.toString() : undefined,
      term_id: h.term_id ? h.term_id.toString() : undefined,
    }));

    term = {
      ...term,
      term_id: term.term_id ? term.term_id.toString() : undefined,
      concept_id: term.concept_id ? term.concept_id.toString() : undefined,
      hints: hints || [],
    };

    res.status(200).json({ data: term });
  } catch (error) {
    console.error("Term 조회 중 오류 발생:", error);
    res.status(500).json({ message: "서버 오류로 Term 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/v2/audio/{audio_ref} - 오디오 파일 서빙 (Static)
// 이 컨트롤러 함수는 직접 사용되지 않고, server.js의 static 미들웨어가 처리합니다.
// audio_ref가 DB에 저장된 파일명 또는 식별자라고 가정합니다.
// 실제 파일은 서버의 특정 디렉토리(예: public/audio)에 있어야 합니다.
// 아래 함수는 예시일 뿐이며, 실제 서빙은 static 미들웨어가 담당합니다.
exports.getAudio = (req, res) => {
  // 실제 로직은 server.js의 express.static에서 처리
  res
    .status(404)
    .send(
      "Audio file handling is managed by static middleware. Ensure the file exists."
    );
};
