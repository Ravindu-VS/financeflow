# API Documentation
## FinAI Enterprise

---

## Base URL
All API requests are routed through the API Gateway:
`http://localhost:8080/api/v1`

## Authentication
Most endpoints require a JWT Bearer token obtained via the `/auth/login` endpoint.
Provide the token in the request header:
`Authorization: Bearer <your_access_token>`

---

## 1. Authentication Endpoints

### 1.1 Register
`POST /auth/register`
Creates a new user account.

**Request Body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "normal_user" // Optional: "normal_user" or "financial_advisor"
}
```

**Response (200 OK):**
```json
{
  "message": "User registered successfully"
}
```

### 1.2 Login
`POST /auth/login`
Authenticates a user and returns JWT tokens.

**Request Body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "id_token": "eyJhbGci...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "roles": ["normal_user"]
  }
}
```

---

## 2. AI & Analytics Endpoints

### 2.1 AI Financial Advisor Chat
`POST /ai/chat`
*Rate Limit: 20 req/min*

**Request Body (JSON):**
```json
{
  "message": "How can I reduce my dining expenses?",
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there! How can I help you today?"}
  ]
}
```

**Response (200 OK):**
```json
{
  "response": "Based on your recent transactions, you spent $400 on dining out last month...",
  "insight_type": "saving_recommendation",
  "confidence": 0.89,
  "suggestions": ["Set a dining budget", "Cook at home twice a week"],
  "model": "gemini-2.0-flash"
}
```

### 2.2 Calculate Financial Health Score
`GET /health-score/calculate`

**Response (200 OK):**
```json
{
  "health_score": 75,
  "health_grade": "B",
  "breakdown": {
    "saving_rate": {"score": 80, "message": "Good saving habits"},
    "expense_ratio": {"score": 70, "message": "Expenses are slightly high"}
  },
  "recommendations": [
    {"action": "Increase emergency fund", "priority": "high"}
  ]
}
```

### 2.3 Fraud & Anomaly Detection
`GET /fraud/scan`

**Response (200 OK):**
```json
{
  "anomalies": [
    {
      "expense_id": "uuid",
      "title": "Unusual Electronics Purchase",
      "amount": 1500,
      "z_score": 3.2,
      "reason": "Significantly higher than average category spend"
    }
  ],
  "duplicates": []
}
```

### 2.4 Expense Predictions
`GET /predictions/expenses`

**Response (200 OK):**
```json
{
  "forecast": [
    {"month": "2024-08", "predicted_amount": 2100.50},
    {"month": "2024-09", "predicted_amount": 2150.00},
    {"month": "2024-10", "predicted_amount": 2200.75}
  ],
  "confidence_interval": 15.0
}
```

---

## 3. Financial Management Endpoints

*Note: All endpoints support standard CRUD operations. Below are examples of the primary listing endpoints.*

### 3.1 Get Income
`GET /income`

### 3.2 Get Expenses
`GET /expenses`

### 3.3 Get Budgets
`GET /budgets`

### 3.4 Get Investments
`GET /investments`

---

## 4. Voice Assistant

### 4.1 Process Voice Command
`POST /voice/process`

**Request Body (JSON):**
```json
{
  "transcript": "Add an expense of 50 dollars for groceries today"
}
```

**Response (200 OK):**
```json
{
  "intent": "add_expense",
  "entities": {
    "amount": 50,
    "category": "groceries",
    "date": "2024-07-18"
  },
  "confidence": 0.95
}
```

---

## 5. Report Generation

### 5.1 Generate Report
`POST /reports/generate`
*Rate Limit: 5 req/5min*

**Request Body (JSON):**
```json
{
  "type": "monthly",
  "format": "pdf", // or "excel", "csv"
  "period_start": "2024-06-01",
  "period_end": "2024-06-30"
}
```

**Response (200 OK):**
```json
{
  "report_id": "uuid",
  "download_url": "/downloads/reports/uuid.pdf",
  "status": "completed"
}
```

---

## 6. Advisor Endpoints

### 6.1 Get Assigned Clients
`GET /advisor/clients`
*Requires Role: `financial_advisor` or `admin`*

**Response (200 OK):**
```json
{
  "clients": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "health_score": 75
    }
  ]
}
```
