# EmCoin Investment Portal

A secure, API-driven investment portal with separate client and administrator experiences.

## Included

- Secure authentication with short-lived access tokens and rotating refresh-token cookies
- Public registration restricted to client accounts
- TOTP two-factor authentication integrated into login
- PostgreSQL migrations and valid demo seeding
- Client portfolios, holdings, dividends, statements, and service requests
- Administrator client summaries and requests workflow
- Shared latest-price and FX valuation service
- Authenticated PDF statement generation and Socket.IO rooms
- Docker Compose and GitHub Actions validation

## Local development

Copy `.env.example` to `.env`, replace the development placeholders, then run:

```bash
npm install
npm run migrate --workspace backend
npm run seed --workspace backend
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:5000`

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Frontend: `http://localhost:3000`

## Demo accounts

- Admin: `admin@demo.com` / `Admin@123456`
- Client: `client1@demo.com` / `Client@123456`

Never run the demo seed in production.

## Validation

```bash
npm run check
```

Before regulated production use, add institutional SSO, maker-checker workflows, immutable audit retention, managed secrets, TLS, encrypted backups, and jurisdiction-specific privacy controls.
