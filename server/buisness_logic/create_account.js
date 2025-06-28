const db = require('../db');

const createAccount = (customerName, accountType = 'savings', initialDeposit = 0) => {
    return new Promise((resolve, reject) => {
        const accountNumber = 'ACC' + Date.now().toString().slice(-6);
        const deposit = parseFloat(initialDeposit);

        if (deposit < 0) {
            return reject({ error: 'Initial deposit cannot be negative' });
        }

        if (!customerName || customerName.trim().length < 2) {
            return reject({ error: 'Valid customer name is required' });
        }

        const validAccountTypes = ['savings', 'checking', 'business'];
        if (!validAccountTypes.includes(accountType.toLowerCase())) {
            return reject({ error: 'Invalid account type. Must be savings, checking, or business' });
        }

        const creditLimit = accountType.toLowerCase() === 'checking' ? 1000.00 : 0.00;

        db.run(
            'INSERT INTO accounts (account_number, customer_name, balance, account_type, credit_limit) VALUES (?, ?, ?, ?, ?)',
            [accountNumber, customerName.trim(), deposit, accountType.toLowerCase(), creditLimit],
            function(err) {
                if (err) {
                    reject({ error: 'Failed to create account', details: err.message });
                } else {
                    resolve({
                        success: true,
                        accountNumber,
                        customerName: customerName.trim(),
                        accountType: accountType.toLowerCase(),
                        initialBalance: deposit.toFixed(2),
                        creditLimit: creditLimit.toFixed(2)
                    });
                }
            }
        );
    });
};

module.exports = { createAccount };
