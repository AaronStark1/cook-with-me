# Cook With Me 🍳

A full-stack recipe management application built with **Angular** (frontend) and **Express.js + MongoDB** (backend).

## Project Structure

```
cook-with-me/
├── frontend/       # Angular 20 application
├── backend/        # Express.js REST API
└── README.md
```

## Frontend (Angular)

### Setup
```bash
cd frontend
npm install
npm start
```
Runs on `http://localhost:4200`

### Features
- Browse & search recipes
- User registration & login
- Save favorite recipes
- Admin dashboard (manage recipes, users, downloads)
- PDF download of recipes
- Charts & analytics via Highcharts

## Backend (Express.js)

### Setup
```bash
cd backend
npm install
cp .env.example .env   # then fill in your values
node index.js
```

### Environment Variables
| Variable   | Description                    |
|------------|--------------------------------|
| `MONGO_DB` | MongoDB connection string      |
| `JWT_KEY`  | Secret key for JWT signing     |

### API Endpoints
- **Auth**: Register, Login
- **Recipes**: CRUD operations
- **Saved Recipes**: Save/unsave recipes
- **Downloads**: Track recipe downloads
- **Testimonies**: User testimonials

## Tech Stack
- **Frontend**: Angular 20, Bootstrap 5, Highcharts, jsPDF
- **Backend**: Express.js 5, Mongoose, JWT, bcrypt
- **Database**: MongoDB Atlas
