import db from './database.mjs';

export const migrateDatabase = () => {
    try {
        console.log('Checking for database migrations...');
        
        // Check if we need to migrate from old transactions table
        const oldTransactionsExist = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='transactions' 
            AND sql LIKE '%amount INTEGER NOT NULL%'
            AND sql NOT LIKE '%reference VARCHAR%'
        `).get();

        if (oldTransactionsExist) {
            console.log('Migrating from old transactions schema...');
            
            // Create temporary backup
            db.exec(`
                CREATE TABLE IF NOT EXISTS transactions_backup AS 
                SELECT * FROM transactions
            `);
            
            // Drop old table
            db.exec('DROP TABLE transactions');
            
            // Recreate with new schema
            const schema = `
                CREATE TABLE transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    amount INTEGER NOT NULL,
                    credits INTEGER NOT NULL DEFAULT 0,
                    reference VARCHAR(255) UNIQUE,
                    status VARCHAR(50) NOT NULL DEFAULT 'completed',
                    type VARCHAR(50) NOT NULL DEFAULT 'one_time',
                    subscription_type VARCHAR(50),
                    subscription_ends_at DATETIME,
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `;
            db.exec(schema);
            
            // Migrate data
            db.exec(`
                INSERT INTO transactions 
                (id, user_id, amount, credits, status, type, created_at)
                SELECT id, user_id, amount, amount, 'completed', 'one_time', created_at 
                FROM transactions_backup
            `);
            
            // Drop backup
            db.exec('DROP TABLE transactions_backup');
            
            console.log('Transactions table migrated successfully');
        }

        // Check and create indexes if they don't exist
        const indexes = [
            'idx_transactions_user_id',
            'idx_transactions_reference', 
            'idx_transactions_created_at'
        ];

        indexes.forEach(indexName => {
            const indexExists = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='index' AND name=?
            `).get(indexName);

            if (!indexExists) {
                console.log(`Creating index: ${indexName}`);
                
                if (indexName === 'idx_transactions_user_id') {
                    db.exec('CREATE INDEX idx_transactions_user_id ON transactions(user_id)');
                } else if (indexName === 'idx_transactions_reference') {
                    db.exec('CREATE INDEX idx_transactions_reference ON transactions(reference)');
                } else if (indexName === 'idx_transactions_created_at') {
                    db.exec('CREATE INDEX idx_transactions_created_at ON transactions(created_at)');
                }
            }
        });

        console.log('Database migration completed successfully');
    } catch (error) {
        console.error('Error during database migration:', error);
        // Don't throw error for migration failures - the app should still start
    }
};