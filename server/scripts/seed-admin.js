/**
 * seed-admin.js
 *
 * Standalone manual administrative provisioning script.
 * Usage: node scripts/seed-admin.js
 *
 * Safety Guarantees:
 * - Checks if an administrator account already exists.
 * - NEVER touches or resets passwords on existing accounts.
 * - Supports environment variable overrides for credentials:
 *   ADMIN_DEFAULT_EMAIL (default: admin@smartprep.com)
 *   ADMIN_DEFAULT_PASSWORD (default: Password123!)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../config/db');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = (process.env.ADMIN_DEFAULT_EMAIL || 'admin@smartprep.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Password123!';

    // Strict Production Secret Enforcement
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ADMIN_DEFAULT_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD === 'Password123!') {
        throw new Error('FATAL: In production, ADMIN_DEFAULT_PASSWORD must be explicitly configured as a non-default secret in environment variables.');
      }
    }

    // Check if any admin account already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log(`[SeedAdmin] An administrator account already exists (${existingAdmin.email}). Existing passwords and data were NOT touched.`);
      await closeDB();
      process.exit(0);
    }

    // Check if user exists with target email but different role
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      console.log(`[SeedAdmin] User with email ${adminEmail} already exists with role '${existingUser.role}'. To prevent accidental credential loss, passwords will not be reset. Please promote the user manually or choose another email.`);
      await closeDB();
      process.exit(0);
    }

    // Create fresh administrator account
    const newAdmin = await User.create({
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      isActive: true,
    });

    console.log(`[SeedAdmin] Successfully created initial administrator account: ${newAdmin.email}`);
    await closeDB();
    process.exit(0);
  } catch (error) {
    console.error(`[SeedAdmin] Error seeding administrator: ${error.message}`);
    try {
      await closeDB();
    } catch (_) {}
    process.exit(1);
  }
};

seedAdmin();
