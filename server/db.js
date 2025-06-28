const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.resolve(__dirname, 'database.sqlite');

// Create database connection with better error handling
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables if they don't exist
db.serialize(() => {
    // Chat sessions table
    db.run(`CREATE TABLE IF NOT EXISTS chat_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        status TEXT DEFAULT 'active'
    )`, (err) => {
        if (err) {
            console.error('Error creating chat_sessions table:', err.message);
        } else {
            console.log('Chat sessions table ready');
        }
    });

    // Messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message_text TEXT NOT NULL,
        sender TEXT NOT NULL,
        message_type TEXT DEFAULT 'message',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions (session_id)
    )`, (err) => {
        if (err) {
            console.error('Error creating messages table:', err.message);
        } else {
            console.log('Messages table ready');
        }
    });

    // Banking queries table for analytics
    db.run(`CREATE TABLE IF NOT EXISTS banking_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        query_type TEXT,
        query_text TEXT,
        response_text TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions (session_id)
    )`, (err) => {
        if (err) {
            console.error('Error creating banking_queries table:', err.message);
        } else {
            console.log('Banking queries table ready');
        }
    });

    // Accounts table for banking operations
    db.run(`CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        balance DECIMAL(15,2) DEFAULT 0.00,
        account_type TEXT DEFAULT 'savings',
        status TEXT DEFAULT 'active',
        credit_limit DECIMAL(15,2) DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating accounts table:', err.message);
        } else {
            console.log('Accounts table ready');
        }
    });

    // Transactions table for banking operations
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT UNIQUE NOT NULL,
        from_account TEXT,
        to_account TEXT,
        amount DECIMAL(15,2) NOT NULL,
        transaction_type TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'completed',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_account) REFERENCES accounts (account_number),
        FOREIGN KEY (to_account) REFERENCES accounts (account_number)
    )`, (err) => {
        if (err) {
            console.error('Error creating transactions table:', err.message);
        } else {
            console.log('Transactions table ready');
        }
    });

    // Insert sample accounts for testing (only if they don't exist)
    db.get("SELECT COUNT(*) as count FROM accounts", (err, row) => {
        if (err) {
            console.error('Error checking accounts:', err.message);
        } else if (row.count === 0) {
            console.log('Inserting sample accounts...');
            
            const sampleAccounts = [
                ['ACC001', 'John Doe', 5000.00, 'savings', 'active', 10000.00],
                ['ACC002', 'Jane Smith', 3500.00, 'checking', 'active', 5000.00],
                ['ACC003', 'Bob Johnson', 1200.00, 'savings', 'active', 2000.00],
                ['ACC004', 'Alice Brown', 7500.00, 'checking', 'active', 8000.00],
                ['ACC005', 'Charlie Wilson', 2800.00, 'business', 'active', 15000.00]
            ];

            const stmt = db.prepare(`INSERT INTO accounts 
                (account_number, customer_name, balance, account_type, status, credit_limit) 
                VALUES (?, ?, ?, ?, ?, ?)`);

            sampleAccounts.forEach(account => {
                stmt.run(account, (err) => {
                    if (err) {
                        console.error('Error inserting sample account:', err.message);
                    }
                });
            });

            stmt.finalize((err) => {
                if (err) {
                    console.error('Error finalizing statement:', err.message);
                } else {
                    console.log('Sample accounts inserted successfully');
                }
            });
        } else {
            console.log(`Found ${row.count} existing accounts`);
        }
    });

    // Create indexes for better performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_banking_queries_session_id ON banking_queries(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_number ON accounts(account_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON transactions(from_account)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp)`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    db.close(() => {
        process.exit(1);
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    db.close(() => {
        process.exit(1);
    });
});

// Export database connection
module.exports = db;