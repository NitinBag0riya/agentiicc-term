/**
 * Webhook logging for debugging and audit
 */
import { query } from './postgres';

export interface WebhookLog {
  id: number;
  update_id?: number;
  payload: any;
  processed_at: Date;
}

/**
 * Log webhook payload (fire-and-forget)
 * Does not throw errors - logs to console if fails
 */
export async function logWebhook(payload: any): Promise<void> {
  try {
    const updateId = payload?.update_id;

    await query(
      `INSERT INTO webhook_logs (update_id, payload) VALUES ($1, $2)`,
      [updateId, JSON.stringify(payload)]
    );
  } catch (error) {
    // Fire-and-forget: log error but don't throw
    console.error('[WebhookLog] Failed to log webhook:', error);
  }
}

/**
 * Get recent webhook logs
 */
export async function getRecentWebhookLogs(limit = 100): Promise<WebhookLog[]> {
  return await query<WebhookLog>(
    `SELECT * FROM webhook_logs ORDER BY processed_at DESC LIMIT $1`,
    [limit]
  );
}

/**
 * Get webhook logs by update_id
 */
export async function getWebhookLogsByUpdateId(updateId: number): Promise<WebhookLog[]> {
  return await query<WebhookLog>(
    `SELECT * FROM webhook_logs WHERE update_id = $1 ORDER BY processed_at DESC`,
    [updateId]
  );
}

/**
 * Search webhook logs by JSON path
 * Example: searchWebhookLogs("message.from.id", 123456789)
 */
export async function searchWebhookLogs(
  jsonPath: string,
  value: any,
  limit = 100
): Promise<WebhookLog[]> {
  return await query<WebhookLog>(
    `SELECT * FROM webhook_logs
     WHERE payload @> $1::jsonb
     ORDER BY processed_at DESC
     LIMIT $2`,
    [JSON.stringify({ [jsonPath]: value }), limit]
  );
}

/**
 * Clean up old webhook logs (older than N days)
 */
export async function cleanupOldWebhookLogs(daysToKeep = 30): Promise<number> {
  const result = await query<{ count: number }>(
    `DELETE FROM webhook_logs
     WHERE processed_at < NOW() - INTERVAL '${daysToKeep} days'
     RETURNING id`
  );

  const deletedCount = result.length;
  console.log(`[WebhookLog] Cleaned up ${deletedCount} old logs (older than ${daysToKeep} days)`);

  return deletedCount;
}
