const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session state management
const sessionStates = new Map();

// Initialize session state
const initializeSessionState = (sessionId) => {
    if (!sessionStates.has(sessionId)) {
        sessionStates.set(sessionId, {
            currentFlow: null,
            currentStep: 0,
            data: {},
            waitingFor: null
        });
    }
    return sessionStates.get(sessionId);
};

// Account creation flow
const accountCreationFlow = [
    {
        step: 'name',
        prompt: 'What is your full name?',
        validation: (input) => input.trim().length >= 2,
        errorMessage: 'Please enter a valid name (at least 2 characters).'
    },
    {
        step: 'accountType',
        prompt: 'What type of account would you like to create?• Savings\n• Checking\n• Business\n\nPlease type your choice:',
        validation: (input) => ['savings', 'checking', 'business'].includes(input.toLowerCase()),
        errorMessage: 'Please choose from: Savings, Checking, or Business.'
    },
    {
        step: 'initialDeposit',
        prompt: 'How much would you like to deposit initially? (Enter amount in dollars, minimum $0):',
        validation: (input) => !isNaN(parseFloat(input)) && parseFloat(input) >= 0,
        errorMessage: 'Please enter a valid amount (numbers only, minimum $0).'
    }
];

// Fund transfer flow
const transferFlow = [
    {
        step: 'fromAccount',
        prompt: 'Which account would you like to transfer FROM? (Enter account number like ACC001):',
        validation: (input) => /^ACC\d{3,}$/i.test(input),
        errorMessage: 'Please enter a valid account number (format: ACC001).'
    },
    {
        step: 'toAccount',
        prompt: 'Which account would you like to transfer TO? (Enter account number like ACC002):',
        validation: (input) => /^ACC\d{3,}$/i.test(input),
        errorMessage: 'Please enter a valid account number (format: ACC002).'
    },
    {
        step: 'amount',
        prompt: 'How much would you like to transfer? (Enter amount in dollars):',
        validation: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0,
        errorMessage: 'Please enter a valid amount greater than $0.'
    }
];

// Withdrawal flow
const withdrawalFlow = [
    {
        step: 'account',
        prompt: 'Which account would you like to withdraw from? (Enter account number like ACC001):',
        validation: (input) => /^ACC\d{3,}$/i.test(input),
        errorMessage: 'Please enter a valid account number (format: ACC001).'
    },
    {
        step: 'amount',
        prompt: 'How much would you like to withdraw? (Enter amount in dollars):',
        validation: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0,
        errorMessage: 'Please enter a valid amount greater than $0.'
    }
];

// Deposit flow
const depositFlow = [
    {
        step: 'account',
        prompt: 'Which account would you like to deposit to? (Enter account number like ACC001):',
        validation: (input) => /^ACC\d{3,}$/i.test(input),
        errorMessage: 'Please enter a valid account number (format: ACC001).'
    },
    {
        step: 'amount',
        prompt: 'How much would you like to deposit? (Enter amount in dollars):',
        validation: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0,
        errorMessage: 'Please enter a valid amount greater than $0.'
    }
];

// Process conversational flow
const processConversationalFlow = async (sessionId, userMessage, flowType, flowSteps) => {
    const state = initializeSessionState(sessionId);
    const currentStep = flowSteps[state.currentStep];
    
    if (!currentStep) {
        // Flow completed, execute the action
        return await executeFlowAction(sessionId, flowType, state.data);
    }
    
    // Validate current input
    if (state.currentStep > 0 || state.waitingFor) {
        const isValid = currentStep.validation(userMessage);
        if (!isValid) {
            return {
                text: currentStep.errorMessage + '\n\n' + currentStep.prompt,
                type: `${flowType}_validation_error`
            };
        }
        
        // Store the validated input
        state.data[currentStep.step] = userMessage.trim();
    }
    
    // Move to next step
    state.currentStep++;
    
    // Check if flow is complete
    if (state.currentStep >= flowSteps.length) {
        return await executeFlowAction(sessionId, flowType, state.data);
    }
    
    // Show next prompt
    const nextStep = flowSteps[state.currentStep];
    state.waitingFor = nextStep.step;
    
    return {
        text: nextStep.prompt,
        type: `${flowType}_step_${nextStep.step}`
    };
};

// Execute the final action after flow completion
const executeFlowAction = async (sessionId, flowType, data) => {
    const state = sessionStates.get(sessionId);
    
    try {
        let result;
        
        switch (flowType) {
            case 'account_creation':
                result = await createAccount(data.name, data.accountType, parseFloat(data.initialDeposit));
                // Clear session state
                sessionStates.delete(sessionId);
                return {
                    text: `🎉 Account Created Successfully!\n\n📋 Account Details:\n• Account Number: ${result.accountNumber}\n• Customer Name: ${result.customerName}\n• Account Type: ${result.accountType}\n• Initial Balance: $${result.initialBalance}\n• Credit Limit: $${result.creditLimit}\n\nYour account is now active and ready to use! Is there anything else I can help you with?`,
                    type: 'account_creation_success',
                    data: result
                };
                
            case 'transfer':
                result = await transferFunds(data.fromAccount.toUpperCase(), data.toAccount.toUpperCase(), data.amount);
                sessionStates.delete(sessionId);
                return {
                    text: `✅ Transfer Completed Successfully!\n\n📋 Transaction Details:\n• Transaction ID: ${result.transactionId}\n• Amount: $${result.amount}\n• From: ${result.fromAccount}\n• To: ${result.toAccount}\n• Date: ${new Date(result.timestamp).toLocaleString()}\n\nYour transfer has been processed. Is there anything else I can help you with?`,
                    type: 'transfer_success',
                    data: result
                };
                
            case 'withdrawal':
                result = await withdrawFunds(data.account.toUpperCase(), data.amount);
                sessionStates.delete(sessionId);
                return {
                    text: `✅ Withdrawal Completed Successfully!\n\n📋 Transaction Details:\n• Transaction ID: ${result.transactionId}\n• Amount: $${result.amount}\n• Account: ${result.accountNumber}\n• Date: ${new Date(result.timestamp).toLocaleString()}\n\nYour withdrawal has been processed. Is there anything else I can help you with?`,
                    type: 'withdrawal_success',
                    data: result
                };
                
            case 'deposit':
                result = await depositFunds(data.account.toUpperCase(), data.amount);
                sessionStates.delete(sessionId);
                return {
                    text: `✅ Deposit Completed Successfully!\n\n📋 Transaction Details:\n• Transaction ID: ${result.transactionId}\n• Amount: $${result.amount}\n• Account: ${result.accountNumber}\n• New Balance: $${result.newBalance}\n• Date: ${new Date(result.timestamp).toLocaleString()}\n\nYour deposit has been processed. Is there anything else I can help you with?`,
                    type: 'deposit_success',
                    data: result
                };
        }
    } catch (error) {
        sessionStates.delete(sessionId);
        return {
            text: `❌ Error: ${error.error || 'An unexpected error occurred'}. Please try again or contact customer service at 1-800-BANK-HELP.`,
            type: 'error',
            error: error
        };
    }
};

// Enhanced banking bot response logic with conversational flows
const getBankingBotResponse = async (userMessage, sessionId) => {
    const lowerMessage = userMessage.toLowerCase();
    const state = initializeSessionState(sessionId);
    
    try {
        // Check if we're in the middle of a flow
        if (state.currentFlow) {
            switch (state.currentFlow) {
                case 'account_creation':
                    return await processConversationalFlow(sessionId, userMessage, 'account_creation', accountCreationFlow);
                case 'transfer':
                    return await processConversationalFlow(sessionId, userMessage, 'transfer', transferFlow);
                case 'withdrawal':
                    return await processConversationalFlow(sessionId, userMessage, 'withdrawal', withdrawalFlow);
                case 'deposit':
                    return await processConversationalFlow(sessionId, userMessage, 'deposit', depositFlow);
            }
        }
        
        // Start new flows based on user intent
        if (lowerMessage.includes('create account') || lowerMessage.includes('open account') || lowerMessage.includes('new account')) {
            state.currentFlow = 'account_creation';
            state.currentStep = 0;
            state.data = {};
            state.waitingFor = 'name';
            return {
                text: 'I\'ll help you create a new account! Let\'s start with some basic information.\n\n' + accountCreationFlow[0].prompt,
                type: 'account_creation_start'
            };
        }
        
        else if (lowerMessage.includes('transfer') || lowerMessage.includes('send money')) {
            state.currentFlow = 'transfer';
            state.currentStep = 0;
            state.data = {};
            state.waitingFor = 'fromAccount';
            return {
                text: 'I\'ll help you transfer funds between accounts.\n\n' + transferFlow[0].prompt,
                type: 'transfer_start'
            };
        }
        
        else if (lowerMessage.includes('withdraw') || lowerMessage.includes('cash out')) {
            state.currentFlow = 'withdrawal';
            state.currentStep = 0;
            state.data = {};
            state.waitingFor = 'account';
            return {
                text: 'I\'ll help you withdraw funds from your account.\n\n' + withdrawalFlow[0].prompt,
                type: 'withdrawal_start'
            };
        }
        
        else if (lowerMessage.includes('deposit') || lowerMessage.includes('add money')) {
            state.currentFlow = 'deposit';
            state.currentStep = 0;
            state.data = {};
            state.waitingFor = 'account';
            return {
                text: 'I\'ll help you deposit funds to your account.\n\n' + depositFlow[0].prompt,
                type: 'deposit_start'
            };
        }
        
        // Single-turn operations (no conversation flow needed)
        else if (lowerMessage.includes('balance') || lowerMessage.includes('check balance')) {
            const accountMatch = userMessage.match(/ACC\d{3,}/i);
            if (accountMatch) {
                const result = await checkBalance(accountMatch[0].toUpperCase());
                return {
                    text: `💰 Account Balance for ${result.account}:\n\n👤 Customer: ${result.customer}\n💵 Current Balance: $${result.balance}\n🏦 Account Type: ${result.accountType}`,
                    type: 'balance_inquiry',
                    data: result
                };
            } else {
                return {
                    text: "Please provide your account number to check your balance.\n\nExample: 'Check balance for ACC001'",
                    type: 'balance_inquiry_prompt'
                };
            }
        }
        
        else if (lowerMessage.includes('transaction history') || lowerMessage.includes('statement')) {
            const accountMatch = userMessage.match(/ACC\d{3,}/i);
            if (accountMatch) {
                const result = await getTransactionHistory(accountMatch[0].toUpperCase(), 5);
                let historyText = `📊 Transaction History for ${result.accountNumber}:\n\n`;
                
                if (result.transactions.length === 0) {
                    historyText += "No transactions found.";
                } else {
                    result.transactions.forEach((txn, index) => {
                        historyText += `${index + 1}. ${txn.type.toUpperCase()} - $${txn.amount} (${txn.direction.toUpperCase()})\n`;
                        historyText += `   ${txn.description} - ${new Date(txn.timestamp).toLocaleDateString()}\n\n`;
                    });
                }
                
                return {
                    text: historyText,
                    type: 'transaction_history',
                    data: result
                };
            } else {
                return {
                    text: "Please provide your account number to view transaction history.\n\nExample: 'Show transaction history for ACC001'",
                    type: 'transaction_history_prompt'
                };
            }
        }
        
        else if (lowerMessage.includes('cancel') || lowerMessage.includes('stop')) {
            if (state.currentFlow) {
                sessionStates.delete(sessionId);
                return {
                    text: "Operation cancelled. How else can I help you today?",
                    type: 'operation_cancelled'
                };
            } else {
                return {
                    text: "No operation to cancel. How can I help you today?",
                    type: 'no_operation_to_cancel'
                };
            }
        }
        
        else if (lowerMessage.includes('help') || lowerMessage.includes('commands')) {
            return {
                text: `🏦 Available Banking Services:\n\n💳 Account Services:\n• "Create account" - Open a new account\n• "Check balance for ACC001" - View account balance\n\n💸 Transactions:\n• "Transfer money" - Transfer between accounts\n• "Withdraw money" - Withdraw from account\n• "Deposit money" - Deposit to account\n\n📊 Information:\n• "Transaction history for ACC001" - View recent transactions\n• "Help" - Show this menu\n• "Cancel" - Stop current operation\n\nJust tell me what you'd like to do in plain English!`,
                type: 'help'
            };
        }
        
        else {
            return {
                text: "I can help you with banking operations like creating accounts, checking balances, transferring funds, and more. Type 'help' to see all available services, or just tell me what you'd like to do!",
                type: 'general_inquiry'
            };
        }
        
    } catch (error) {
        console.error('Business logic error:', error);
        sessionStates.delete(sessionId);
        return {
            text: `❌ Error: ${error.error || 'An unexpected error occurred'}. Please try again or contact customer service at 1-800-BANK-HELP.`,
            type: 'error',
            error: error
        };
    }
};

// Business Logic Functions (same as before, but I'll include them for completeness)
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

                    db.get(
                        'SELECT account_number FROM accounts WHERE account_number = ? AND status = "active"',
                        [toAccount],
                        (err, destAccount) => {
                            if (err || !destAccount) {
                                db.run('ROLLBACK');
                                return reject({ error: 'Destination account not found or inactive' });
                            }

                            db.run(
                                'UPDATE accounts SET balance = balance - ? WHERE account_number = ?',
                                [transferAmount, fromAccount],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject({ error: 'Failed to debit source account' });
                                    }

                                    db.run(
                                        'UPDATE accounts SET balance = balance + ? WHERE account_number = ?',
                                        [transferAmount, toAccount],
                                        (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject({ error: 'Failed to credit destination account' });
                                            }

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

                    db.run(
                        'UPDATE accounts SET balance = balance - ? WHERE account_number = ?',
                        [withdrawAmount, accountNumber],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject({ error: 'Failed to process withdrawal' });
                            }

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

const depositFunds = (accountNumber, amount, description = 'Cash Deposit') => {
    return new Promise((resolve, reject) => {
        const transactionId = uuidv4();
        const depositAmount = parseFloat(amount);

        if (depositAmount <= 0) {
            return reject({ error: 'Deposit amount must be greater than zero' });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.get(
                'SELECT balance FROM accounts WHERE account_number = ? AND status = "active"',
                [accountNumber],
                (err, account) => {
                    if (err || !account) {
                        db.run('ROLLBACK');
                        return reject({ error: 'Account not found or inactive' });
                    }

                    db.run(
                        'UPDATE accounts SET balance = balance + ? WHERE account_number = ?',
                        [depositAmount, accountNumber],
                        (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject({ error: 'Failed to process deposit' });
                            }

                            db.run(
                                'INSERT INTO transactions (transaction_id, to_account, amount, transaction_type, description) VALUES (?, ?, ?, ?, ?)',
                                [transactionId, accountNumber, depositAmount, 'deposit', description],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject({ error: 'Failed to record transaction' });
                                    }

                                    db.get(
                                        'SELECT balance FROM accounts WHERE account_number = ?',
                                        [accountNumber],
                                        (err, updatedAccount) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject({ error: 'Failed to get updated balance' });
                                            }

                                            db.run('COMMIT');
                                            resolve({
                                                success: true,
                                                transactionId,
                                                accountNumber,
                                                amount: depositAmount.toFixed(2),
                                                newBalance: parseFloat(updatedAccount.balance).toFixed(2),
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
        });
    });
};

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

// API Routes
app.post('/api/chat/start', (req, res) => {
    const sessionId = uuidv4();
    db.run(
        'INSERT INTO chat_sessions (session_id, status) VALUES (?, ?)',
        [sessionId, 'active'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create chat session' });
            }

            const welcomeMessage = "Welcome to BankBot Assistant! 🏦 can help you with:\n• Creating new accounts\n• Checking balances\n• Transferring funds\n• Withdrawals & deposits\n• Transaction history\n\nJust tell me what you'd like to do in plain English! Type 'help' for more options.";
            
            db.run(
                'INSERT INTO messages (session_id, message_text, sender, message_type) VALUES (?, ?, ?, ?)',
                [sessionId, welcomeMessage, 'bot', 'welcome'],
                function(err) {
                    if (err) {
                        console.error('Error inserting welcome message:', err);
                    }
                }
            );

            res.json({
                sessionId,
                message: 'Chat session started successfully',
                welcomeMessage
            });
        }
    );
});

app.post('/api/chat/message', async (req, res) => {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
        return res.status(400).json({ error: 'Session ID and message are required' });
    }

    db.run(
        'INSERT INTO messages (session_id, message_text, sender, message_type) VALUES (?, ?, ?, ?)',
        [sessionId, message, 'user', 'message'],
        async function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to save user message' });
            }

            try {
                const botResponse = await getBankingBotResponse(message, sessionId);
                
                db.run(
                    'INSERT INTO messages (session_id, message_text, sender, message_type) VALUES (?, ?, ?, ?)',
                    [sessionId, botResponse.text, 'bot', 'message'],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Failed to save bot response' });
                        }

                        db.run(
                            'INSERT INTO banking_queries (session_id, query_type, query_text, response_text) VALUES (?, ?, ?, ?)',
                            [sessionId, botResponse.type, message, botResponse.text]
                        );

                        res.json({
                            message: botResponse.text,
                            type: botResponse.type,
                            data: botResponse.data || null,
                            timestamp: new Date().toISOString()
                        });
                    }
                );
            } catch (error) {
                console.error('Error processing message:', error);
                res.status(500).json({ error: 'Failed to process message' });
            }
        }
    );
});

// Other existing routes remain the same
app.get('/api/chat/:sessionId/messages', (req, res) => {
    const { sessionId } = req.params;
    db.all(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
        [sessionId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch messages' });
            }
            res.json({ messages: rows });
        }
    );
});

app.post('/api/chat/end', (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
    }

    // Clear session state
    sessionStates.delete(sessionId);

    db.run(
        'UPDATE chat_sessions SET ended_at = CURRENT_TIMESTAMP, status = ? WHERE session_id = ?',
        ['ended', sessionId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to end chat session' });
            }

            const endMessage = "Thank you for using BankBot Assistant. Your chat session has been ended securely. We appreciate your time and hope we were able to help you today.";
            db.run(
                'INSERT INTO messages (session_id, message_text, sender, message_type) VALUES (?, ?, ?, ?)',
                [sessionId, endMessage, 'bot', 'system']
            );

            res.json({ message: 'Chat session ended successfully' });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Multi-turn conversational banking bot ready!');
    console.log('Features: Account creation, transfers, withdrawals, deposits with step-by-step flows');
});
