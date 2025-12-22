import { open } from "sqlite";
import sqlite3 from "sqlite3";

async function reminderDB() {
    return open({
        filename: './database/reminder_list.db',
        driver: sqlite3.Database
    });
}

export async function createReminderDB() {
    const db = await reminderDB();
    await db.exec(`
        CREATE TABLE IF NOT EXISTS reminder_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            role_id TEXT,
            custom_description TEXT
        )
    `);
    return db;
}

export async function createBossReminderDB() {
    const db = await reminderDB();
    await db.exec(`
        CREATE TABLE IF NOT EXISTS boss_hp_reminder (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mob_id TEXT NOT NULL,
            mob_name TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            role_id TEXT,
            hp_percent INTEGER NOT NULL,
            region TEXT NOT NULL DEFAULT 'NA'
        )
    `);
    
    // Migration: Add region column if it doesn't exist
    try {
        await db.exec(`ALTER TABLE boss_hp_reminder ADD COLUMN region TEXT NOT NULL DEFAULT 'NA'`);
    } catch (e) {
        // Column already exists, ignore
    }
    
    return db;
}