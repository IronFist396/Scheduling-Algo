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

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/interview_scheduler?schema=public"
```

Replace `USERNAME` and `PASSWORD` with your PostgreSQL credentials.

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

This will parse the CSV and insert all candidates and OCs:

```bash
node prisma/seed.js
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
