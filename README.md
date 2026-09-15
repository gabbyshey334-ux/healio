# Healio

Hospital appointment booking system for **Federal Polytechnic Ilaro Medical Clinic**.

Students and staff can book clinic appointments online instead of queuing in person.

## Stack

- **Frontend:** React (Vite) + React Router
- **Backend:** Node.js + Express
- **Database:** MySQL

## Project structure

```
Healio/
├── frontend/     # React app (Vite)
├── backend/      # Express API
├── database/     # MySQL connection + migrations
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- MySQL running locally

## Environment setup

1. Copy the backend env example and fill in your MySQL credentials:

```bash
cp backend/.env.example backend/.env
```

2. Edit `backend/.env` (include `JWT_SECRET`):

```
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=healio
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d
```

Credentials are never hardcoded — they are read from `.env` via `database/connection.js`.

## Database

Create tables from the migration SQL:

```bash
cd backend
npm run migrate
# apply residual waitlist/slot migration if needed:
# mysql … < ../database/migrations/003_waitlist_slots.sql
npm run seed          # full defense demo dataset (wipes patients/appointments/waitlist)
npm run seed -- --keep  # upsert staff only; keep existing patient data
npm test              # critical-path API tests
```

### Demo logins (after `npm run seed`)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | `admin@healio.local` | `Admin123!` | Analytics + appointments |
| Doctor | `doctor@healio.local` | `Doctor123!` | Ada Okoro — today's list + risk badge |
| Patient | `tunde.adebayo@student.fpi.edu.ng` | `Patient123!` | Typical student |
| Risk patient | `chidi.nwosu@student.fpi.edu.ng` | `Patient123!` | 2 past no-shows |
| Waitlist | `ifeanyi.okoro@student.fpi.edu.ng` | `Patient123!` | Notified — Book now |

Inactive doctors (hidden from booking): Funmi Adebayo, Tunde Bakare.

## Run locally

Use two terminals.

### Backend (port 5000)

```bash
cd backend
npm install
npm run dev
```

Health check: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### Frontend (Vite default port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually [http://localhost:5173](http://localhost:5173)).

## Auth API (test with curl)

Base URL: `http://localhost:5000`

### 1. Patient register

```bash
curl -s -X POST http://localhost:5000/api/auth/patients/register \
  -H 'Content-Type: application/json' \
  -d '{
    "matric_or_staff_id": "HND/CS/2021/001",
    "first_name": "Tunde",
    "last_name": "Adebayo",
    "email": "tunde@student.fpi.edu.ng",
    "password": "Patient123!",
    "user_type": "student",
    "phone": "08012345678"
  }'
```

### 2. Patient login

```bash
curl -s -X POST http://localhost:5000/api/auth/patients/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"tunde@student.fpi.edu.ng","password":"Patient123!"}'
```

### 3. Admin login (after `npm run seed`)

Default seed: `admin@healio.local` / `Admin123!`

```bash
curl -s -X POST http://localhost:5000/api/auth/admins/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@healio.local","password":"Admin123!"}'
```

Save the returned `token`, then create a doctor (admin only):

```bash
TOKEN='paste-admin-token-here'

curl -s -X POST http://localhost:5000/api/auth/admins/doctors \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "department_id": 1,
    "first_name": "Bola",
    "last_name": "Adeyemi",
    "email": "bola.adeyemi@healio.local",
    "password": "Doctor123!",
    "specialization": "General Practice"
  }'
```

### 4. Doctor login

Seeded doctor: `doctor@healio.local` / `Doctor123!`  
(or the doctor you created above)

```bash
curl -s -X POST http://localhost:5000/api/auth/doctors/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"doctor@healio.local","password":"Doctor123!"}'
```

### 5. Validate any token

```bash
curl -s http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Successful login/register responses include `{ "token": "...", "user": { ... } }`. Send the token as `Authorization: Bearer <token>` on protected routes.

## Frontend routes

| Path            | Page                 |
|-----------------|----------------------|
| `/`             | Landing (public)     |
| `/home`         | Patient Home         |
| `/login`        | Login                |
| `/register`     | Register             |
| `/book`         | Book appointment     |
| `/waitlist`     | My waitlist          |
| `/doctor`       | Doctor Dashboard     |
| `/admin`        | Admin Dashboard      |
| `/staff/login`  | Staff login          |
