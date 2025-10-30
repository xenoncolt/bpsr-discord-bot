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
            channel_id TEXT NOT NULL,
            role_id TEXT,
            custom_description TEXT
        )
    `);
    return db;
}

