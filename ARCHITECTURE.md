# Djaber.ai - System Architecture

> **Last Updated:** 2026-01-15
> **Purpose:** This document serves as the single source of truth for the Djaber.ai project architecture. Always refer to this when context is lost or when making architectural decisions.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Authentication Flow](#authentication-flow)
7. [Frontend Architecture](#frontend-architecture)
8. [Backend Architecture](#backend-architecture)
9. [Integration Points](#integration-points)
10. [Design Decisions](#design-decisions)
11. [Environment Variables](#environment-variables)

---

## Project Overview

**Djaber.ai** is an AI-powered social media management platform that allows users to:
- Connect Facebook and Instagram business pages via OAuth
- Use AI agents to handle customer conversations automatically 24/7
- View analytics and manage conversations from a centralized dashboard
- Configure AI behavior and response styles

**Core Value Proposition:**
AI-powered customer service automation for social media, reducing response time and improving customer engagement.

---

## Tech Stack

### Frontend
- **Framework:** Next.js 16.1.1 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Fonts:** Syne (headings), Space Grotesk (body)
- **HTTP Client:** fetch API (native)
- **State Management:** React hooks (useState, useEffect)

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js 5.2.1
- **Language:** TypeScript
- **Database:** MySQL 3306
- **ORM:** Prisma 6.19.2
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcryptjs
- **Validation:** express-validator

### External APIs
- **AI Provider:** OpenAI API (GPT-4)
- **Social Media:** Meta Graph API v18.0 (Facebook, Instagram)

### Development Tools
- **Package Manager:** npm
- **TypeScript Compiler:** tsc
- **Dev Server (Backend):** ts-node-dev
- **Dev Server (Frontend):** Next.js dev server
- **Database Management:** Prisma Studio

---

## Project Structure

```
djaber/
├── ARCHITECTURE.md          # This file - system architecture documentation
├── README.md               # Project setup and getting started
├── package.json            # Frontend dependencies
├── next.config.ts          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript config for frontend
│
├── src/                    # Frontend source code
│   ├── app/               # Next.js App Router pages
│   │   ├── page.tsx      # Homepage (landing page)
│   │   ├── layout.tsx    # Root layout
│   │   ├── globals.css   # Global styles and animations
│   │   ├── login/        # Login page (split-screen)
│   │   ├── signup/       # Signup page (split-screen, multi-step)
│   │   ├── forgot-password/ # Password reset page
│   │   ├── docs/         # API documentation page
│   │   ├── pricing/      # Pricing page
│   │   ├── features/     # Features page
│   │   ├── privacy/      # Privacy policy
│   │   ├── terms/        # Terms of service
│   │   └── help/         # Help center with FAQ
│   │
│   ├── components/        # Reusable React components
│   │   ├── Header.tsx    # Main navigation header
│   │   ├── ClientLayout.tsx   # Client-side layout wrapper with AuthProvider
│   │   └── PageTransition.tsx # Page transition handler
│   │
│   ├── contexts/          # React Context providers
│   │   └── AuthContext.tsx    # Authentication state management
│   │
│   └── lib/               # Utility libraries
│       └── api.ts         # Backend API client functions
│
└── backend/               # Backend API server
    ├── README.md          # Backend setup instructions
    ├── package.json       # Backend dependencies
    ├── tsconfig.json      # TypeScript config for backend
    ├── .env               # Environment variables (NOT in git)
    ├── .env.example       # Environment template
    ├── .gitignore         # Git ignore rules
    │
    ├── prisma/
    │   ├── schema.prisma  # Database schema definition
    │   └── migrations/    # Database migration history
    │
    ├── src/
    │   ├── server.ts      # Express app entry point
    │   │
    │   ├── config/
    │   │   └── database.ts       # Prisma client instance
    │   │
    │   ├── controllers/          # Request handlers
    │   │   ├── auth.controller.ts    # register, login, getProfile
    │   │   └── webhook.controller.ts # Meta webhook handlers
    │   │
    │   ├── routes/              # API route definitions
    │   │   ├── auth.routes.ts   # /api/auth/* routes
    │   │   └── webhook.routes.ts # /api/webhooks/* routes
    │   │
    │   ├── middleware/          # Express middleware
    │   │   └── auth.ts          # JWT authentication middleware
    │   │
    │   ├── services/            # Business logic & external APIs
    │   │   ├── ai.service.ts    # OpenAI integration
    │   │   └── meta.service.ts  # Meta Graph API integration
    │   │
    │   └── utils/               # Helper functions (empty for now)
    │
    └── dist/                    # Compiled JavaScript (generated)
```

---

## Database Schema

**Database Name:** `djaber`
**Provider:** MySQL
**Connection:** localhost:3306

### Tables

#### User
Stores user account information.

| Column      | Type     | Description                |
|-------------|----------|----------------------------|
| id          | String   | UUID primary key           |
| email       | String   | Unique email address       |
| password    | String   | Bcrypt hashed password     |
| firstName   | String   | User's first name          |
| lastName    | String   | User's last name           |
| plan        | String   | "individual" or "teams"    |
| createdAt   | DateTime | Account creation timestamp |
| updatedAt   | DateTime | Last update timestamp      |

**Relations:**
- One-to-many with Page
- One-to-many with Conversation

#### Page
Stores connected social media pages.

| Column           | Type    | Description                     |
|------------------|---------|---------------------------------|
| id               | String  | UUID primary key                |
| platform         | String  | "facebook" or "instagram"       |
| pageId           | String  | Platform's page ID              |
| pageName         | String  | Page display name               |
| pageAccessToken  | String  | Encrypted page access token     |
| userId           | String  | Foreign key to User             |
| isActive         | Boolean | Whether page is active          |
| createdAt        | DateTime| Connection timestamp            |
| updatedAt        | DateTime| Last update timestamp           |

**Unique Constraint:** `platform` + `pageId`

**Relations:**
- Many-to-one with User
- One-to-many with Conversation

#### Conversation
Stores customer conversations per page.

| Column      | Type     | Description                      |
|-------------|----------|----------------------------------|
| id          | String   | UUID primary key                 |
| pageId      | String   | Foreign key to Page              |
| senderId    | String   | Platform's user/sender ID        |
| senderName  | String?  | Sender's display name (optional) |
| platform    | String   | "facebook" or "instagram"        |
| userId      | String   | Foreign key to User              |
| status      | String   | "active", "resolved", "archived" |
| createdAt   | DateTime | Conversation start timestamp     |
| updatedAt   | DateTime | Last message timestamp           |

**Unique Constraint:** `platform` + `pageId` + `senderId`

**Relations:**
- Many-to-one with Page
- Many-to-one with User
- One-to-many with Message

#### Message
Stores individual messages in conversations.

| Column         | Type     | Description                    |
|----------------|----------|--------------------------------|
| id             | String   | UUID primary key               |
| conversationId | String   | Foreign key to Conversation    |
| messageId      | String   | Platform's message ID          |
| senderId       | String   | Who sent the message           |
| recipientId    | String   | Who receives the message       |
| text           | String?  | Message text content           |
| timestamp      | DateTime | When message was sent          |
| isFromPage     | Boolean  | true if AI/page, false if user |
| createdAt      | DateTime | Database insert timestamp      |

**Unique Constraint:** `messageId` + `conversationId`

**Relations:**
- Many-to-one with Conversation

#### AISettings
Stores AI configuration per user.

| Column              | Type     | Description                         |
|---------------------|----------|-------------------------------------|
| id                  | String   | UUID primary key                    |
| userId              | String   | Foreign key to User (unique)        |
| aiModel             | String   | "gpt-4", "gpt-3.5-turbo", "claude-3"|
| responseStyle       | String   | "professional", "casual", "friendly"|
| autoReply           | Boolean  | Enable/disable auto-replies         |
| businessContext     | String?  | Context about the business          |
| customInstructions  | String?  | Custom AI behavior instructions     |
| createdAt           | DateTime | Settings creation timestamp         |
| updatedAt           | DateTime | Last update timestamp               |

**Unique Constraint:** `userId`

---

## API Endpoints

**Base URL:** `http://localhost:5000`

### Health & Info

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "Djaber.ai API is running",
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

#### GET /api
API information and available endpoints.

**Response:**
```json
{
  "message": "Welcome to Djaber.ai API",
  "version": "1.0.0",
  "endpoints": {
    "auth": "/api/auth",
    "users": "/api/users",
    "pages": "/api/pages",
    "conversations": "/api/conversations",
    "webhooks": "/api/webhooks"
  }
}
```

### Authentication

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "plan": "individual"
}
```

**Validation:**
- `email`: Must be valid email format
- `password`: Minimum 8 characters
- `firstName`: Required, not empty
- `lastName`: Required, not empty
- `plan`: Optional, must be "individual" or "teams"

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "plan": "individual"
  }
}
```

**Error Response (400):**
```json
{
  "error": "Bad Request",
  "message": "User with this email already exists"
}
```

#### POST /api/auth/login
Login existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "plan": "individual"
  }
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid email or password"
}
```

#### GET /api/auth/profile
Get current user profile (protected route).

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Success Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "plan": "individual",
    "createdAt": "2026-01-15T12:00:00.000Z"
  }
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "No token provided"
}
```

### Webhooks

#### GET /api/webhooks/meta
Meta webhook verification endpoint (for Facebook setup).

**Query Parameters:**
- `hub.mode`: Should be "subscribe"
- `hub.verify_token`: Must match `META_VERIFY_TOKEN` in .env
- `hub.challenge`: Random string from Meta

**Success Response (200):**
Returns the `hub.challenge` value as plain text.

**Error Response (403):**
"Forbidden" - if verification fails

#### POST /api/webhooks/meta
Meta webhook event handler (receives messages from Facebook/Instagram).

**Request Body:** (sent by Meta)
```json
{
  "object": "page",
  "entry": [
    {
      "id": "page_id",
      "messaging": [
        {
          "sender": { "id": "sender_id" },
          "recipient": { "id": "page_id" },
          "message": {
            "mid": "message_id",
            "text": "Hello!",
            "timestamp": 1234567890
          }
        }
      ]
    }
  ]
}
```

**Response (200):**
"EVENT_RECEIVED" - immediate acknowledgment

**Processing Flow:**
1. Save incoming message to database
2. Get user's AI settings
3. If auto-reply enabled:
   - Build conversation history
   - Generate AI response via OpenAI
   - Send response via Meta API
   - Save AI response to database

---

## Authentication Flow

### Registration Flow
1. User submits registration form (frontend)
2. Frontend sends POST request to `/api/auth/register`
3. Backend validates input
4. Backend hashes password with bcrypt
5. Backend creates user in database
6. Backend generates JWT token
7. Frontend receives token and user data
8. Frontend stores token in localStorage
9. Frontend redirects to dashboard

### Login Flow
1. User submits login form (frontend)
2. Frontend sends POST request to `/api/auth/login`
3. Backend finds user by email
4. Backend compares password hash
5. Backend generates JWT token
6. Frontend receives token and user data
7. Frontend stores token in localStorage
8. Frontend redirects to dashboard

### Protected Route Access
1. User navigates to protected page
2. Frontend reads token from localStorage
3. Frontend includes token in Authorization header: `Bearer {token}`
4. Backend middleware extracts and verifies token
5. Backend decodes JWT payload (userId, email)
6. Backend attaches user info to request object
7. Route handler accesses `req.user`

### Token Structure
```
Header: { alg: "HS256", typ: "JWT" }
Payload: { userId: "uuid", email: "user@example.com" }
Signature: HMACSHA256(base64(header) + "." + base64(payload), JWT_SECRET)
```

---

## Frontend Architecture

### Design System

**Color Scheme:** Monochrome (Black & White)
- Background: `#000000` (pure black)
- Cards/Boxes: `#0a0a0a` (solid, non-transparent)
- Hover states: `#141414`
- Borders: `white/10` opacity
- Text: White to zinc gradients
- Accents: White/zinc gradients (no cyan/blue/purple)

**Typography:**
- Headings: Syne (400-800 weight)
- Body: Space Grotesk (300-700 weight)

**Key Components:**

#### Split-Screen Layout (Login/Signup)
- Fixed full-screen layout (`fixed inset-0`)
- Left side: Promotional content with rotating data
- Right side: Authentication forms
- No floating headers, only back button with icon
- Animations: Rotating stats, features, testimonials (CSS-based, 5-15s intervals)

#### Grid Background
- Animated grid pattern on homepage
- 75px square grid
- Opacity 0.12 with radial gradient mask
- 5s animation moving grid position
- Located in `src/app/globals.css`

#### Header Component
- Floating design with backdrop blur
- Hidden on auth pages (/login, /signup)
- Managed by `ClientLayout.tsx`

### Page Structure

| Route            | Purpose                    | Layout Type    |
|------------------|----------------------------|----------------|
| /                | Landing page               | Standard       |
| /login           | User login                 | Split-screen   |
| /signup          | User registration          | Split-screen   |
| /forgot-password | Password reset             | Split-screen   |
| /docs            | API documentation          | Standard       |
| /pricing         | Pricing plans              | Standard       |
| /features        | Feature showcase           | Standard       |
| /privacy         | Privacy policy             | Standard       |
| /terms           | Terms of service           | Standard       |
| /help            | Help center with FAQ       | Standard       |

### State Management

**Context API (React Context):**

**AuthContext** (`src/contexts/AuthContext.tsx`):
- Manages authentication state globally
- Provides user information
- Handles login, register, logout operations
- Manages loading and error states
- Automatically syncs with localStorage

**Usage:**
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, login, register, logout, loading, error, isAuthenticated } = useAuth();

  // Access user info
  console.log(user?.email);

  // Login
  await login({ email, password });

  // Register
  await register({ email, password, firstName, lastName, plan });

  // Logout
  logout();
}
```

**Local State (useState):**
- Form inputs
- UI toggles (dropdowns, modals)
- Selected plan in signup
- Active FAQ items
- Component-specific animations

**Future Context Additions:**
- Dashboard data context
- Theme/settings context
- Notification context

### API Communication

**Architecture:**
UI Layer → Context Layer → API Layer → Backend

**API Layer** (`src/lib/api.ts`):
- Centralized API communication
- Generic request handler with error handling
- Type-safe request/response interfaces
- Token management utilities

**Context Layer** (`src/contexts/AuthContext.tsx`):
- Wraps API calls with state management
- Provides React hooks for components
- Handles loading and error states
- Manages localStorage sync

**UI Layer** (Components):
- Uses context hooks (e.g., `useAuth()`)
- No direct API calls
- Clean separation of concerns

**Example Flow:**

```typescript
// 1. API Layer (src/lib/api.ts) - Low-level API calls
export async function login(data: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 2. Context Layer (src/contexts/AuthContext.tsx) - State management
const login = async (credentials: LoginRequest) => {
  try {
    setLoading(true);
    const response = await apiLogin(credentials);
    storeAuthData(response.token, response.user);
    setUser(response.user);
    setIsAuthenticated(true);
  } catch (err) {
    setError(err.message);
    throw err;
  } finally {
    setLoading(false);
  }
};

// 3. UI Layer (components) - Clean component code
function LoginPage() {
  const { login, loading, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(formData);
      router.push('/dashboard');
    } catch (err) {
      // Error already handled by context
    }
  };
}
```

**Protected API Calls:**
- Token automatically included via `getAuthHeader()` in api.ts
- No manual token management in components
- Automatic logout on token expiration

---

## Backend Architecture

### Request Flow

1. **Request arrives** → Express app receives HTTP request
2. **CORS middleware** → Validates origin (Frontend URL)
3. **Body parsing** → `express.json()` parses request body
4. **Route matching** → Express router matches path
5. **Validation** → `express-validator` validates input
6. **Authentication** (if protected) → JWT middleware verifies token
7. **Controller** → Business logic executes
8. **Service layer** → External API calls (AI, Meta)
9. **Database** → Prisma ORM queries MySQL
10. **Response** → JSON response sent back

### Middleware Stack

**Order matters:**
1. CORS
2. Body parser (json, urlencoded)
3. Route-specific middleware (validation, auth)
4. 404 handler
5. Global error handler

### Error Handling

**Validation Errors (400):**
```typescript
const errors = validationResult(req);
if (!errors.isEmpty()) {
  res.status(400).json({ errors: errors.array() });
  return;
}
```

**Authentication Errors (401):**
```typescript
res.status(401).json({
  error: 'Unauthorized',
  message: 'Invalid token'
});
```

**Server Errors (500):**
```typescript
res.status(500).json({
  error: 'Internal Server Error',
  message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
});
```

### Service Layer

**AI Service (`ai.service.ts`):**
- `generateAIResponse()` - Generates AI replies using OpenAI
- `moderateContent()` - Content moderation via OpenAI

**Meta Service (`meta.service.ts`):**
- `sendMessage()` - Sends messages via Meta Graph API
- `getPageInfo()` - Fetches page information
- `verifyWebhook()` - Verifies webhook authenticity

### Security

**Password Security:**
- Bcrypt hashing with salt rounds (10)
- Never store plain text passwords

**JWT Security:**
- Secret key stored in environment variable
- Token should be rotated/refreshed (future implementation)
- HTTPS required in production

**API Security:**
- CORS configured for specific origin
- Input validation on all endpoints
- SQL injection prevented by Prisma parameterized queries
- Rate limiting (future implementation)

---

## Integration Points

### Frontend ↔ Backend

**Authentication:**
- Frontend: Login/Signup forms
- Backend: `/api/auth/register`, `/api/auth/login`
- Token storage: localStorage
- Token usage: Authorization header

**Protected Routes (Future):**
- Dashboard
- Settings
- Conversations
- Analytics

### Backend ↔ OpenAI

**Purpose:** Generate AI responses for customer messages

**Flow:**
1. User message received via webhook
2. Backend builds conversation history
3. Backend calls `generateAIResponse()` with:
   - Conversation history
   - Business context (from user settings)
   - Custom instructions
   - AI model preference
4. OpenAI returns response
5. Backend sends via Meta API

**Configuration:**
- API Key: `OPENAI_API_KEY` in .env
- Model: Configurable per user (default: gpt-4)
- Temperature: 0.7
- Max tokens: 500

### Backend ↔ Meta Graph API

**Purpose:** Send/receive messages from Facebook/Instagram

**Webhook Setup:**
1. Create Facebook App at developers.facebook.com
2. Enable Messenger/Instagram permissions
3. Set webhook URL: `https://yourdomain.com/api/webhooks/meta`
4. Set verify token (matches `META_VERIFY_TOKEN` in .env)
5. Subscribe to `messages` events

**OAuth Flow (Future):**
1. User clicks "Connect Page" in dashboard
2. Redirect to Facebook OAuth dialog
3. User grants page permissions
4. Facebook redirects back with access token
5. Backend saves page info and token to database

**Sending Messages:**
```typescript
POST https://graph.facebook.com/v18.0/me/messages
?access_token={PAGE_ACCESS_TOKEN}

Body: {
  recipient: { id: "user_id" },
  message: { text: "Response from AI" }
}
```

---

## Design Decisions

### Why Next.js over Laravel?
- Better for AI integrations (JavaScript ecosystem)
- Real-time webhook handling
- Easier to scale frontend/backend separately
- Modern React ecosystem

### Why Express over Laravel?
- Same language as frontend (TypeScript)
- Lightweight and flexible
- Excellent async support for webhooks
- Easy AI/Meta API integrations

### Why MySQL over PostgreSQL?
- User preference
- Widely available hosting
- Sufficient for current needs

### Why Prisma over TypeORM?
- Better TypeScript support
- Auto-generated types
- Intuitive schema definition
- Great migration system

### Why JWT over Sessions?
- Stateless authentication
- Easier to scale horizontally
- Works well with mobile apps (future)
- No server-side session storage needed

### Why Split-Screen Layout for Auth?
- Modern, premium feel
- Informative (shows value while user signs up)
- Reduces friction with engaging content
- Matches AI product aesthetic

### Why Monochrome Design?
- Professional, premium appearance
- Timeless, not trendy
- Focuses attention on content
- Matches AI/tech industry standards

### Why No Page Transition Animations?
- User reported glitches
- Better performance without
- Cleaner, faster experience
- Animations still used within pages

---

## Environment Variables

### Backend (.env)

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="mysql://root:mysql@localhost:3306/djaber"

# JWT Secret
JWT_SECRET=djaber-secret-key-change-in-production-2026
JWT_EXPIRE=7d

# Meta/Facebook API
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_VERIFY_TOKEN=djaber_webhook_verify_token

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Anthropic Claude API (Optional)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Webhook URL (for Meta to send messages)
WEBHOOK_URL=http://localhost:5000/api/webhooks/meta
```

### Frontend (Future - if needed)

```bash
# API Base URL
NEXT_PUBLIC_API_URL=http://localhost:5000

# Frontend URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

---

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
npm install
npm run dev
# Runs on http://localhost:3000
```

### Production Build

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
npm run build
npm start
```

### Database Management

**Generate Prisma Client:**
```bash
cd backend
npm run prisma:generate
```

**Create Migration:**
```bash
cd backend
npm run prisma:migrate
```

**Open Prisma Studio (GUI):**
```bash
cd backend
npm run prisma:studio
```

---

## Future Enhancements

### Planned Features
- Dashboard page with conversation list
- Page connection via Facebook OAuth
- Real-time conversation view
- Message history
- AI settings configuration page
- Analytics and insights
- Team collaboration features
- Multi-language support
- Conversation tags and categories
- Automated workflows and triggers

### Technical Improvements
- Add rate limiting to API
- Implement refresh tokens for JWT
- Add request logging
- Set up error tracking (Sentry)
- Add API response caching
- Implement WebSockets for real-time updates
- Add unit and integration tests
- Set up CI/CD pipeline
- Docker containerization
- Production deployment guide

---

## Troubleshooting

### Common Issues

**Backend won't start:**
- Check if MySQL is running
- Verify DATABASE_URL in .env
- Run `npm run prisma:generate`

**Database connection error:**
- Ensure MySQL database "djaber" exists
- Check username/password in DATABASE_URL
- Verify MySQL is running on port 3306

**Frontend can't reach backend:**
- Ensure backend is running on port 5000
- Check CORS configuration in backend
- Verify API URL in frontend code

**JWT authentication fails:**
- Check JWT_SECRET is set in backend .env
- Verify token is stored in localStorage
- Check Authorization header format: `Bearer {token}`

**Webhook verification fails:**
- Ensure META_VERIFY_TOKEN matches in:
  - Backend .env file
  - Facebook App webhook settings
- Check webhook URL is publicly accessible (use ngrok for local testing)

---

## Contact & Maintenance

**Last Updated:** 2026-01-15
**Project Status:** Active Development
**Maintainer:** Claude Code

**When to Update This Document:**
- Adding new features or pages
- Changing database schema
- Adding new API endpoints
- Modifying authentication flow
- Changing tech stack decisions
- Adding new environment variables
- Updating external API integrations

**Always refer to this document when:**
- Starting a new session
- Making architectural decisions
- Onboarding new developers
- Troubleshooting issues
- Planning new features
