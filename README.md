# ISMP Interview Scheduler

A Next.js application for scheduling ISMP mentor interviews using an optimal constraint-based algorithm.

## Features

- 🎯 **Smart Scheduling**: Availability-constrained-first greedy algorithm
- 📅 **Multi-day Support**: Schedule across 50+ days automatically
- 👥 **OC Management**: Requires both OCs to be present for each interview
- 📊 **Dashboard**: Visual calendar view with statistics
- ✅ **Status Tracking**: Mark interviews as completed/cancelled

## Setup Instructions

### 1. Database Setup

Make sure PostgreSQL is running locally. Create a database:

```bash
# In PostgreSQL
CREATE DATABASE interview_scheduler;
```

### 2. Environment Configuration

Create a `.env` file in the root directory (use `.env.example` as template):

```env
# Database
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/interview_scheduler?schema=public"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-key-min-32-characters-long"

# Admin User Credentials (for seeding)
ADMIN_EMAIL="your-admin@example.com"
ADMIN_PASSWORD="your-secure-password"
ADMIN_NAME="Admin User"

# Schedule Configuration
SCHEDULE_START_DATE="2026-03-02"
```

Replace:
- `USERNAME` and `PASSWORD` with your PostgreSQL credentials
- `NEXTAUTH_SECRET` with a random 32+ character string
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` with your desired admin credentials
- `SCHEDULE_START_DATE` with your interview schedule start date (YYYY-MM-DD format)

### 3. Install Dependencies

```bash
npm install
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Run Database Migrations

```bash
npx prisma migrate dev --name init
```

### 6. Seed the Database

Seed candidates and OCs from CSV:

```bash
node prisma/seed.js
```

Seed admin user for authentication:

```bash
node prisma/seedUser.js
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) - you'll be redirected to the login page.

Login with the credentials you set in `.env`:
- Email: Your `ADMIN_EMAIL`
- Password: Your `ADMIN_PASSWORD`

## Configuration

### Schedule Start Date

The interview schedule start date is configured via the `SCHEDULE_START_DATE` environment variable. This date is used throughout the application:

- **API Routes**: Server-side scheduling calculations
- **Frontend**: Calendar navigation and date display
- **Algorithms**: All scheduling algorithm variants

To change the schedule start date, simply update the `SCHEDULE_START_DATE` in your `.env` file:

```env
SCHEDULE_START_DATE="2026-03-02"  # Format: YYYY-MM-DD
```

**Important**: After changing the date, restart your development server for changes to take effect.

### Authentication

The application uses NextAuth.js for authentication. All routes and API endpoints are protected and require login.

- **Login Page**: `/login`
- **Protected Routes**: All pages except login
- **Protected APIs**: All `/api/*` endpoints (except `/api/auth/*`)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
