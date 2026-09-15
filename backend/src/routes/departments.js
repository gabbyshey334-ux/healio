/**
 * Departments + doctors listing for the booking flow.
 *   GET /api/departments
 *   GET /api/departments/:id/doctors
 */

import { Router } from 'express';
import pool from '../../../database/connection.js';

const router = Router();

/** All departments — used by Home browse and Book step 1 */
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description, created_at, updated_at
       FROM departments
       ORDER BY name ASC`,
    );
    return res.status(200).json({ departments: rows });
  } catch (err) {
    console.error('List departments error:', err);
    return res.status(500).json({ error: 'Could not load departments' });
  }
});

/** Active doctors in a department — Book step 2 */
router.get('/:id/doctors', async (req, res) => {
  try {
    const departmentId = Number(req.params.id);
    if (!Number.isInteger(departmentId) || departmentId < 1) {
      return res.status(400).json({ error: 'Invalid department id' });
    }

    const [departments] = await pool.query(
      `SELECT id, name, description FROM departments WHERE id = ? LIMIT 1`,
      [departmentId],
    );

    if (departments.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const [doctors] = await pool.query(
      `SELECT id, department_id, first_name, last_name, specialization, is_active
       FROM doctors
       WHERE department_id = ? AND is_active = 1
       ORDER BY last_name ASC, first_name ASC`,
      [departmentId],
    );

    return res.status(200).json({
      department: departments[0],
      doctors,
    });
  } catch (err) {
    console.error('List department doctors error:', err);
    return res.status(500).json({ error: 'Could not load doctors' });
  }
});

export default router;
