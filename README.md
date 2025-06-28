# 💬 BankBot Assistant – Conversational Banking Chatbot

A full-stack conversational banking assistant built with a **React frontend** and **Node.js/Express backend**, using **SQLite** for persistent chat sessions and banking operations.

---

## 🚀 Features

- **Multi-turn Conversational Flows** – Step-by-step guidance for complex banking operations  
- **Account Management** – Create savings, checking, or business accounts  
- **Transaction Operations** – Transfer funds, withdraw, deposit with real-time validation  
- **Balance Inquiries** – Check balances and view transaction history  
- **Session Management** – Persistent chat sessions with state management  
- **Offline Mode** – Fallback behavior when the backend is unavailable  
- **Security** – 256-bit encryption for secure conversations  

---

## 🛠️ Tech Stack

### Frontend
- React 18
- Axios (for API communication)
- Tailwind CSS (for styling)
- CRACO

### Backend
- Node.js
- Express.js
- SQLite3 (for database)
- UUID (for unique identifiers)
- CORS (for cross-origin requests)

---

## 📁 Project Structure

```
chat-app/
├── public/
├── server/
│   ├── business_logic/
│   │   ├── balance_check.js
│   │   ├── create_account.js
│   │   ├── fund_transfer.js
│   │   ├── transaction_history.js
│   │   └── withdraw.js
│   ├── database.sqlite
│   ├── db.js
│   ├── server.js
│   └── package.json
├── src/
│   ├── App.js
│   ├── index.js
│   └── index.css
├── craco.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── README.md
```

---

## 🧰 Installation & Setup

### ✅ Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

### 📦 Install Dependencies

1. Navigate to the root project directory:
   ```bash
   cd chat-app
   ```

2. Install all dependencies:
   ```bash
   npm install
   cd server && npm install
   cd ..
   ```

3. Install concurrently and nodemon at the root:
   ```bash
   npm install concurrently nodemon --save-dev
   ```

4. Add this to the **root `package.json`** scripts section:
   ```json
   "scripts": {
     "start": "concurrently \"npm run server-dev\" \"npm run client\"",
     "server": "cd server && node server.js",
     "server-dev": "cd server && nodemon server.js",
     "client": "react-scripts start",
     "build": "react-scripts build",
     "dev": "concurrently \"npm run server-dev\" \"npm run client\""
   }
   ```

---

## 🚦 Run the App

After installing all dependencies, simply run:

```bash
npm start
```

This will:
- 🔁 Start the backend with `nodemon` (for live reloading)
- 🖥️ Launch the frontend with `react-scripts`
- 🌐 Open your React app at `http://localhost:3000`
- ⚙️ Serve the backend API on `http://localhost:5000`

---

## 📡 API Endpoints

### Chat Management
- `POST /api/chat/start` – Start a new chat session  
- `POST /api/chat/message` – Send a message and get a response  
- `POST /api/chat/end` – End a chat session  
- `GET /api/chat/:sessionId/messages` – Retrieve past messages  

---

## 💳 Banking Operations

### 🏦 Account Creation
- Choose between savings, checking, or business
- Validate customer info and initial deposit
- Auto-generate account numbers

### 💸 Fund Transfers
- Transfer between valid accounts
- Real-time balance checks
- Each transaction has a unique ID

### 🏧 Withdrawals & Deposits
- Handle deposits and withdrawals securely
- Overdraft protection supported
- Full logging of transactions

### 📊 Balance Inquiries
- View current balance
- See recent transactions
- Account status and type info

---

## 🧪 Sample Accounts (Pre-loaded)

| Account Number | Customer Name   | Balance   | Type     | Credit Limit |
|----------------|------------------|-----------|----------|---------------|
| ACC001         | John Doe         | $5,000.00 | Savings  | $10,000.00    |
| ACC002         | Jane Smith       | $3,500.00 | Checking | $5,000.00     |
| ACC003         | Bob Johnson      | $1,200.00 | Savings  | $2,000.00     |
| ACC004         | Alice Brown      | $7,500.00 | Checking | $8,000.00     |
| ACC005         | Charlie Wilson   | $2,800.00 | Business | $15,000.00    |

---

## 🔒 Security Features

- Session-based chat management  
- Input validation and sanitization  
- Protection against SQL injection via parameterized queries  
- Transaction rollback on failure  
- Graceful handling of invalid inputs or connection failures  

---

## ⚠️ Error Handling

Robust error responses for:
- Database connection issues  
- Invalid account numbers  
- Insufficient funds  
- Offline or network failures  
- Backend unavailability (fallback to offline mode)

---

## 🙏 Acknowledgments

- Built with Create React App / CRACO  
- Lightweight DB using SQLite  
- Implements conversational AI design patterns
