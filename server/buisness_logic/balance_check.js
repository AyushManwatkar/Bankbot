const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const checkBalance = (accountNumber) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT account_number, customer_name, balance, account_type FROM accounts WHERE account_number = ? AND status = "active"',
            [accountNumber],
            (err, row) => {
                if (err) {
                    reject({ error: 'Database error occurred', details: err.message });
                } else if (!row) {
                    reject({ error: 'Account not found or inactive' });
                } else {
                    resolve({
                        success: true,
                        account: row.account_number,
                        customer: row.customer_name,
                        balance: parseFloat(row.balance).toFixed(2),
                        accountType: row.account_type
                    });
                }
            }
        );
    });
};

module.exports = { checkBalance };
