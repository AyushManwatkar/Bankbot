const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const withdrawFunds = (accountNumber, amount, description = 'ATM Withdrawal') => {
    return new Promise((resolve, reject) => {
        const transactionId = uuidv4();
        const withdrawAmount = parseFloat(amount);

        if (withdrawAmount <= 0) {
            return reject({ error: 'Withdrawal amount must be greater than zero' });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.get(
                'SELECT balance, credit_limit FROM accounts WHERE account_number = ? AND status = "active"',
                [accountNumber],
                (err, account) => {
                    if (err || !account) {
                        db.run('ROLLBACK');
                        return reject({ error: 'Account not found or inactive' });
                    }

                    const availableBalance = parseFloat(account.balance) + parseFloat(account.credit_limit);
                    
                    if (withdrawAmount > availableBalance) {
                        db.run('ROLLBACK');
                        return reject({ 
                            error: 'Insufficient funds for withdrawal',
                            available: availableBalance.toFixed(2),
                            requested: withdrawAmount.toFixed(2)
                        });
                    }

                    // Update account balance
                    db.run(
                        'UPDATE accounts SET balance = balance - ? WHERE account_number = ?',
                        [withdrawAmount, accountNumber],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject({ error: 'Failed to process withdrawal' });
                            }

                            // Record transaction
                            db.run(
                                'INSERT INTO transactions (transaction_id, from_account, amount, transaction_type, description) VALUES (?, ?, ?, ?, ?)',
                                [transactionId, accountNumber, withdrawAmount, 'withdrawal', description],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject({ error: 'Failed to record transaction' });
                                    }

                                    db.run('COMMIT');
                                    resolve({
                                        success: true,
                                        transactionId,
                                        accountNumber,
                                        amount: withdrawAmount.toFixed(2),
                                        description,
                                        timestamp: new Date().toISOString()
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    });
};

module.exports = { withdrawFunds };
