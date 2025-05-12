const { pool } = require("../server");

// GET /api/v2/notifications
exports.getNotifications = async (req, res) => {
  const userId = req.user.userId;
  let conn;
  try {
    conn = await pool.getConnection();

    // 1. 사용자 알림 목록 조회 (최신순)
    const [rows] = await conn.query(
      "SELECT notification_id, type, message, is_read, created_at, related_entity_type, related_entity_id FROM Notifications WHERE recipient_user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    const notifications = rows.map((n) => ({
      ...n,
      notification_id: n.notification_id
        ? n.notification_id.toString()
        : undefined,
      related_entity_id: n.related_entity_id
        ? n.related_entity_id.toString()
        : undefined,
    }));

    // 2. 읽지 않은 알림 수 계산
    const unreadCount = notifications.filter((n) => !n.is_read).length;

    res.status(200).json({ data: notifications, unreadCount: unreadCount });
  } catch (error) {
    console.error("알림 목록 조회 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 알림 목록 조회에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/v2/notifications/{notification_id}/read
exports.markNotificationAsRead = async (req, res) => {
  const userId = req.user.userId;
  const { notificationId } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();

    // 1. 알림 존재 및 수신자 확인 후 is_read 업데이트
    const [result] = await conn.query(
      "UPDATE Notifications SET is_read = true WHERE notification_id = ? AND recipient_user_id = ?",
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      // 알림이 없거나, 본인 알림이 아니거나, 이미 읽음 상태인 경우
      // 알림 존재 여부를 먼저 확인하여 404를 반환하는 것이 더 좋을 수 있음
      const [notifications] = await conn.query(
        "SELECT notification_id FROM Notifications WHERE notification_id = ?",
        [notificationId]
      );
      if (!notifications) {
        return res
          .status(404)
          .json({ message: "해당 알림을 찾을 수 없습니다." });
      }
      // 알림은 존재하나 본인 것이 아닌 경우 (또는 이미 읽음)
      return res
        .status(403)
        .json({ message: "알림을 읽음 처리할 수 없거나 이미 처리되었습니다." });
    }

    console.log(
      `Notification marked as read: notificationId=${notificationId}, userId=${userId}`
    );
    res.status(200).json({ message: "알림을 성공적으로 읽음 처리했습니다." });
  } catch (error) {
    console.error("알림 읽음 처리 중 오류 발생:", error);
    res
      .status(500)
      .json({ message: "서버 오류로 알림 읽음 처리에 실패했습니다." });
  } finally {
    if (conn) conn.release();
  }
};
