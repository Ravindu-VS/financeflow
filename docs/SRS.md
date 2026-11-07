# Software Requirements Specification (SRS)
## FinAI Enterprise

---

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for **FinAI Enterprise**, an AI-powered financial management SaaS platform. The platform uses modern WSO2 enterprise patterns, integrating API Management, Identity Server functionality, and Integrator BI capabilities combined with an advanced AI backend (Google Gemini 2.0 Flash) and a responsive React frontend.

### 1.2 Scope
FinAI Enterprise provides users with tools for income and expense tracking, budget management, savings goals, and investment tracking. In addition to standard CRUD operations, it features an AI Financial Advisor using a RAG pipeline, ML-based expense predictions, a multi-dimensional financial health scoring system, fraud detection using statistical models (Z-score), and a voice assistant for NLP-based data entry.

### 1.3 Definitions and Acronyms
- **AI**: Artificial Intelligence
- **API**: Application Programming Interface
- **CRUD**: Create, Read, Update, Delete
- **JWT**: JSON Web Token
- **ML**: Machine Learning
- **NLP**: Natural Language Processing
- **OIDC**: OpenID Connect
- **PWA**: Progressive Web App
- **RAG**: Retrieval-Augmented Generation
- **RBAC**: Role-Based Access Control

---

## 2. Overall Description

### 2.1 Product Perspective
FinAI Enterprise replaces legacy, monolithic financial tracking systems with a scalable microservices architecture. It demonstrates WSO2 capabilities by abstracting routing, analytics, and rate-limiting to an API Gateway, separating identity management, and orchestrating intelligent data flows through a FastAPI AI backend.

### 2.2 User Classes and Characteristics
- **Normal User**: Individuals tracking personal finances. Can access their own data, use AI features, and generate reports.
- **Financial Advisor**: Professionals who can view assigned clients' data, analyze their financial health, and offer recommendations.
- **Admin**: System administrators with full platform access.

### 2.3 Operating Environment
- **Backend**: Python 3.11+, Node.js 20+
- **Database**: PostgreSQL 16, Redis 7, MongoDB (Legacy Data)
- **Frontend**: Modern web browsers (Chrome, Firefox, Safari, Edge)
- **Deployment**: Docker, Kubernetes

---

## 3. System Features

### 3.1 API Management & Gateway (WSO2 Pattern)
- **Description**: All API requests route through a centralized API Gateway.
- **Requirements**:
  - Must validate JWT Bearer tokens on incoming requests.
  - Must enforce rate limits (100 req/min globally, 20 req/min for AI, 5 req/5min for reports).
  - Must proxy validated requests to appropriate backend services.
  - Must collect and expose real-time API analytics.

### 3.2 Identity & Security (WSO2 IS Pattern)
- **Description**: Comprehensive authentication and authorization.
- **Requirements**:
  - Secure user registration and login with bcrypt password hashing.
  - OAuth2/OIDC compliant token issuance (access_token, refresh_token, id_token).
  - RBAC implementation restricting access based on user role.
  - Complete audit logging of all sensitive actions.

### 3.3 Core Financial Management
- **Description**: Standard personal finance tracking.
- **Requirements**:
  - CRUD operations for Income, Expenses, Budgets, Savings Goals, and Investments.
  - Multi-user Family Group support for shared wallets and expenses.

### 3.4 AI Financial Advisor (Integrator BI Pattern)
- **Description**: Conversational AI assistant.
- **Requirements**:
  - Must retrieve context via a RAG pipeline utilizing the user's financial data.
  - Integration with Google Gemini 2.0 Flash (with OpenAI fallback).
  - Must provide actionable insights without giving explicit financial advice.

### 3.5 Predictive Analytics & ML
- **Description**: Forecasting and anomaly detection.
- **Requirements**:
  - Expense prediction for 3 months ahead using linear regression.
  - Fraud detection identifying expenses with a Z-score > 2.5 or duplicate transactions.
  - Multi-dimensional Financial Health Score calculation (0-100 scale).

### 3.6 Voice Assistant (NLP)
- **Description**: Hands-free data entry.
- **Requirements**:
  - Parse voice transcripts using Regex to extract intents (e.g., 'add expense') and entities (amount, category, date).

### 3.7 Enterprise Reporting
- **Description**: Generating formatted financial reports.
- **Requirements**:
  - Must generate PDF (using ReportLab) and Excel (using openpyxl) reports.
  - Reports must summarize income, expenses, budgets, and investments over a specified period.

---

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
- API Gateway latency must be under 50ms (excluding backend processing).
- AI Advisor response time must be under 3 seconds on average.
- Support up to 1,000 concurrent users per deployment instance.

### 4.2 Security Requirements
- All data must be transmitted over HTTPS.
- Passwords must be hashed using bcrypt (12 rounds).
- Implement protection against SQL Injection using parameterized queries (SQLAlchemy).
- Implement CORS policies restricting access to valid frontend domains.

### 4.3 Availability and Reliability
- System target uptime is 99.9%.
- Redis must act as an in-memory cache and rate limiter.
- Kubernetes deployment must support rolling updates with zero downtime.

### 4.4 Maintainability
- Codebase must be fully documented and follow standard conventions (PEP-8 for Python).
- Microservices architecture must allow individual services to be updated independently.
