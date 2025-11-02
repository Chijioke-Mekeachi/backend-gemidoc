import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Database Setup ---

// Resolve path to database file from .env or use a default
const dbPath = process.env.DATABASE_PATH || 'db/dr_gemini.db';

// Ensure the directory exists
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.dirname(path.resolve(__dirname, '..', dbPath));
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create and configure the database instance
const db = new Database(dbPath, { verbose: console.log });

// Enable WAL mode for better concurrency and performance.
// It allows reads and writes to happen simultaneously.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Initializes the database by creating tables from the schema.sql file.
 * This function is idempotent and safe to run on every application start.
 */
export function initDb() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        db.exec(schema);
        console.log('Database initialized successfully.');
        
        // Set updated_at for existing users if it's NULL
        try {
            db.exec(`
                UPDATE users SET updated_at = CURRENT_TIMESTAMP 
                WHERE updated_at IS NULL
            `);
        } catch (error) {
            // This might fail if the column doesn't exist yet, which is fine
            console.log('Note: updated_at migration not needed');
        }
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

// Export the database instance for use in other modules
export default db;