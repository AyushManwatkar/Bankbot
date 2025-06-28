const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const transferFunds = (fromAccount, toAccount, amount, description = 'Fund Transfer') => {
    return new Promise((resolve, reject) => {
        const transactionId = uuidv4();
        const transferAmount = parseFloat(amount);

        if (transferAmount <= 0) {
            return reject({ error: 'Transfer amount must be greater than zero' });
        }

        if (fromAccount === toAccount) {
            return reject({ error: 'Cannot transfer to the same account' });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Check source account balance and existence
            db.get(
                'SELECT balance, credit_limit FROM accounts WHERE account_number = ? AND status = "active"',
                [fromAccount],
                (err, sourceAccount) => {
                    if (err || !sourceAccount) {
                        db.run('ROLLBACK');
                        return reject({ error: 'Source account not found or inactive' });
                    }

                    const availableBalance = parseFloat(sourceAccount.balance) + parseFloat(sourceAccount.credit_limit);
                    
                    if (transferAmount > availableBalance) {
                        db.run('ROLLBACK');
                        return reject({ 
                            error: 'Insufficient funds',
                            available: availableBalance.toFixed(2),
                            requested: transferAmount.toFixed(2)
                        });
                    }

                    // Check destination account existence
                    db.get(
                        'SELECT account_number FROM accounts WHERE account_number = ? AND status = "active"',
                        [toAccount],
                        (err, destAccount) => {
                            if (err || !destAccount) {
                                db.run('ROLLBACK');
                                return reject({ error: 'Destination account not found or inactive' });
                            }

                            // Update source account balance
                            db.run(
                                'UPDATE accounts SET balance = balance - ? WHERE account_number = ?',
                                [transferAmount, fromAccount],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject({ error: 'Failed to debit source account' });
                                    }

                                    // Update destination account balance
                                    db.run(
                                        'UPDATE accounts SET balance = balance + ? WHERE account_number = ?',
                                        [transferAmount, toAccount],
                                        (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject({ error: 'Failed to credit destination account' });
                                            }

                                            // Record transaction
                                            db.run(
                                                'INSERT INTO transactions (transaction_id, from_account, to_account, amount, transaction_type, description) VALUES (?, ?, ?, ?, ?, ?)',
                                                [transactionId, fromAccount, toAccount, transferAmount, 'transfer', description],
                                                (err) => {
                                                    if (err) {
                                                        db.run('ROLLBACK');
                                                        return reject({ error: 'Failed to record transaction' });
                                                    }

                                                    db.run('COMMIT');
                                                    resolve({
                                                        success: true,
                                                        transactionId,
                                                        fromAccount,
                                                        toAccount,
                                                        amount: transferAmount.toFixed(2),
                                                        description,
                                                        timestamp: new Date().toISOString()
                                                    });
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    });
};

module.exports = { transferFunds };
