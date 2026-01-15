# Djaber.ai Backend

Backend API for Djaber.ai - AI-powered social media management platform.

## Tech Stack

- **Node.js** with **TypeScript**
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **MySQL** - Database
- **JWT** - Authentication
- **OpenAI API** - AI conversation generation
- **Meta Graph API** - Facebook/Instagram integration

## Prerequisites

- Node.js 18+ installed
- MySQL database running
- Meta/Facebook App created with Messenger permissions
- OpenAI API key

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:
- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - Secret key for JWT tokens (change in production!)
- `META_APP_ID` - Facebook App ID
- `META_APP_SECRET` - Facebook App Secret
- `META_VERIFY_TOKEN` - Webhook verification token
- `OPENAI_API_KEY` - OpenAI API key

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

## Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

## Production

1. Build the TypeScript code:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Database Management

- **Generate Prisma Client**: `npm run prisma:generate`
- **Create Migration**: `npm run prisma:migrate`
- **Open Prisma Studio**: `npm run prisma:studio`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (protected)

### Webhooks
- `GET /api/webhooks/meta` - Meta webhook verification
- `POST /api/webhooks/meta` - Meta webhook events

### Health Check
- `GET /health` - Server health check
- `GET /api` - API information

## Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration files
│   │   └── database.ts # Prisma client
│   ├── controllers/    # Route controllers
│   │   ├── auth.controller.ts
│   │   └── webhook.controller.ts
│   ├── middleware/     # Express middleware
│   │   └── auth.ts     # JWT authentication
│   ├── routes/         # API routes
│   │   ├── auth.routes.ts
│   │   └── webhook.routes.ts
│   ├── services/       # Business logic
│   │   ├── ai.service.ts    # OpenAI integration
│   │   └── meta.service.ts  # Meta API integration
│   ├── utils/          # Helper functions
│   └── server.ts       # Express app entry point
├── prisma/
│   └── schema.prisma   # Database schema
├── .env.example        # Environment variables template
├── .gitignore
├── package.json
└── tsconfig.json
```

## Meta Webhook Setup

1. Go to your Facebook App Dashboard
2. Navigate to Webhooks section
3. Set webhook URL to: `https://yourdomain.com/api/webhooks/meta`
4. Set verify token to match your `META_VERIFY_TOKEN` in `.env`
5. Subscribe to `messages` events

## Security Notes

- Always use HTTPS in production
- Change `JWT_SECRET` to a strong random value
- Never commit `.env` file to version control
- Rotate API keys regularly
- Use environment-specific configurations

## Database Schema

The database includes the following models:
- **User** - User accounts
- **Page** - Connected Facebook/Instagram pages
- **Conversation** - Customer conversations
- **Message** - Individual messages
- **AISettings** - AI configuration per user

## License

ISC
