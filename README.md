# CourtOS Backend

The CourtOS API is a NestJS application providing the backend for a Badminton Court Management system. It uses Supabase for the database, authentication, and file storage.

## Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Setup Environment**:
   Create a `.env` file in the root based on `.env.example`:
   ```env
   NODE_ENV=development
   PORT=3000
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   JWT_SECRET=your_supabase_jwt_secret
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173
   ```
3. **Run the server**:
   ```bash
   npm run start:dev
   ```
   The API will be available at `http://localhost:3000/api`.

## Environment Variables

| Variable                    | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`                  | `development`, `production`, or `test`. Defines logger formats. |
| `PORT`                      | API listening port. Default `3000`.                             |
| `SUPABASE_URL`              | The REST endpoint of your Supabase project.                     |
| `SUPABASE_SERVICE_ROLE_KEY` | The secret admin key (bypasses RLS) to perform admin actions.   |
| `JWT_SECRET`                | The JWT secret used to mint access tokens.                      |
| `CORS_ORIGINS`              | Comma-separated list of allowed frontend origins.               |

## Documentation (Swagger)

Interactive API documentation is generated automatically. Ensure the server is running in development mode, then visit:
👉 **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

## Database Migrations

Migrations are stored in `src/database/migrations/`. Execute the `.sql` files sequentially in the Supabase SQL Editor to construct the schema.

1. `001_initial_schema.sql` (auth, users, courts, bookings constraints)
2. `002_fix_policies.sql` (auth policy bypasses)
3. `003...` - `008...` (various module setups)

## Supabase Requirements

- **Storage Buckets**: You must manually create three Public storage buckets in the Supabase Dashboard before the `/upload` endpoints will operate:
  - `avatars`
  - `courts`
  - `products`
