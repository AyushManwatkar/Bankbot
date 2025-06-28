// business_logic/transaction_history.js
const db = require('../db');

const getTransactionHistory = (accountNumber, limit = 10) => {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT transaction_id, from_account, to_account, amount, transaction_type, description, status, timestamp
             FROM transactions 
             WHERE from_account = ? OR to_account = ?
             ORDER BY timestamp DESC 
             LIMIT ?`,
            [accountNumber, accountNumber, limit],
            (err, rows) => {
                if (err) {
                    reject({ error: 'Failed to fetch transaction history', details: err.message });
                } else {
                    const transactions = rows.map(row => ({
                        transactionId: row.transaction_id,
                        fromAccount: row.from_account,
                        toAccount: row.to_account,
                        amount: parseFloat(row.amount).toFixed(2),
                        type: row.transaction_type,
                        description: row.description,
                        status: row.status,
                        timestamp: row.timestamp,
                        direction: row.from_account === accountNumber ? 'debit' : 'credit'
                    }));

                    resolve({
                        success: true,
                        accountNumber,
                        transactions,
                        count: transactions.length
                    });
                }
            }
        );
    });
};

const getLastTransaction = (accountNumber) => {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT transaction_id, from_account, to_account, amount, transaction_type, description, status, timestamp
             FROM transactions 
             WHERE from_account = ? OR to_account = ?
             ORDER BY timestamp DESC 
             LIMIT 1`,
            [accountNumber, accountNumber],
            (err, row) => {
                if (err) {
                    reject({ error: 'Failed to fetch last transaction', details: err.message });
                } else if (!row) {
                    resolve({
                        success: true,
                        accountNumber,
                        message: 'No transactions found for this account'
                    });
                } else {
                    resolve({
                        success: true,
                        accountNumber,
                        transaction: {
                            transactionId: row.transaction_id,
                            fromAccount: row.from_account,
                            toAccount: row.to_account,
                            amount: parseFloat(row.amount).toFixed(2),
                            type: row.transaction_type,
                            description: row.description,
                            status: row.status,
                            timestamp: row.timestamp,
                            direction: row.from_account === accountNumber ? 'debit' : 'credit'
                        }
                    });
                }
            }
        );
    });
};

module.exports = { getTransactionHistory, getLastTransaction };
