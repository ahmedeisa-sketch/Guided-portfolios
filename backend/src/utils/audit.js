import { query } from '../db.js';

export async function audit({ actorId = null, action, entityType, entityId = null, metadata = {} }) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [actorId, action, entityType, entityId, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Audit write failed', { action, entityType, message: error.message });
  }
}
