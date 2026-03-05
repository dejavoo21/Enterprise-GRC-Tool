/**
 * Seed Admin User Script
 *
 * Creates an initial admin user and workspace membership for development/testing.
 *
 * Usage: npx ts-node --esm src/scripts/seed-admin-user.ts
 * Or:    npm run seed:admin
 */

import { pool } from '../db.js';
import { hashPassword } from '../services/authService.js';

// Default admin credentials (change in production!)
const DEFAULT_EMAIL = 'admin@example.com';
const DEFAULT_PASSWORD = 'Password123!';
const DEFAULT_FULL_NAME = 'Demo Admin';
const DEFAULT_WORKSPACE_ID = 'demo-workspace';
const DEFAULT_ROLE = 'owner';

async function seedAdminUser() {
  console.log('🔐 Seeding admin user...\n');

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [DEFAULT_EMAIL.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️  User "${DEFAULT_EMAIL}" already exists.`);
      console.log('   Skipping user creation.\n');

      // Check if membership exists
      const userId = existingUser.rows[0].id;
      const existingMembership = await pool.query(
        'SELECT id FROM workspace_user_memberships WHERE user_id = $1 AND workspace_id = $2',
        [userId, DEFAULT_WORKSPACE_ID]
      );

      if (existingMembership.rows.length > 0) {
        console.log(`⚠️  User already has membership to workspace "${DEFAULT_WORKSPACE_ID}".`);
      } else {
        // Create membership
        await pool.query(
          `INSERT INTO workspace_user_memberships (user_id, workspace_id, role)
           VALUES ($1, $2, $3)`,
          [userId, DEFAULT_WORKSPACE_ID, DEFAULT_ROLE]
        );
        console.log(`✅ Created membership for user to workspace "${DEFAULT_WORKSPACE_ID}" as "${DEFAULT_ROLE}".`);
      }

      console.log('\n📋 Login credentials:');
      console.log(`   Email:    ${DEFAULT_EMAIL}`);
      console.log(`   Password: ${DEFAULT_PASSWORD}`);
      console.log('\n✨ Done!');
      return;
    }

    // Hash the password
    console.log('   Hashing password...');
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // Create the user
    console.log('   Creating user...');
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, email, full_name`,
      [DEFAULT_EMAIL.toLowerCase(), passwordHash, DEFAULT_FULL_NAME]
    );

    const user = userResult.rows[0];
    console.log(`✅ Created user: ${user.full_name} (${user.email})`);

    // Check if workspace exists
    const workspaceExists = await pool.query(
      'SELECT id FROM workspaces WHERE id = $1',
      [DEFAULT_WORKSPACE_ID]
    );

    if (workspaceExists.rows.length === 0) {
      console.log(`⚠️  Workspace "${DEFAULT_WORKSPACE_ID}" does not exist.`);
      console.log('   Creating workspace...');

      await pool.query(
        `INSERT INTO workspaces (id, name, description)
         VALUES ($1, $2, $3)`,
        [DEFAULT_WORKSPACE_ID, 'Demo Workspace', 'Default workspace for development and testing']
      );
      console.log(`✅ Created workspace: ${DEFAULT_WORKSPACE_ID}`);
    }

    // Create workspace membership
    console.log('   Creating workspace membership...');
    await pool.query(
      `INSERT INTO workspace_user_memberships (user_id, workspace_id, role)
       VALUES ($1, $2, $3)`,
      [user.id, DEFAULT_WORKSPACE_ID, DEFAULT_ROLE]
    );
    console.log(`✅ Added user as "${DEFAULT_ROLE}" to workspace "${DEFAULT_WORKSPACE_ID}"`);

    console.log('\n📋 Login credentials:');
    console.log(`   Email:    ${DEFAULT_EMAIL}`);
    console.log(`   Password: ${DEFAULT_PASSWORD}`);
    console.log('\n✨ Admin user seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
seedAdminUser();
