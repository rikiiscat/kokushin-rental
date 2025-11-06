# KOKUSHIN Rental - Fullstack (Node.js + MySQL)

## 1. Backend Setup
```bash
cd backend
# 1) Create DB & table
mysql -uroot -p < setup.sql

# 2) Install deps
npm install

# 3) Start server (port from .env, default 80)
sudo npm start   # port 80 may require sudo
# or run on 3001 temporarily:
# PORT=3001 node server.js
```

## 2. Frontend
Open `frontend/index.html` in your browser (or use a static server).  
API base is `http://localhost` (port 80). If backend runs on 3001, edit `frontend/script.js` → `const API_BASE = "http://localhost:3001"`.

## 3. API Quick Test
- List cars: `GET http://localhost/api/cars`
- Create car (form-data): `POST http://localhost/api/cars` (fields: `name`, `price`, `description`, `photo`)
- Update car: `PUT http://localhost/api/cars/:id`
- Delete car: `DELETE http://localhost/api/cars/:id`

## 4. Notes
- Uploads are served from `/uploads` path.
- If you see CORS issues, ensure the frontend is served from file or from a server and backend enables CORS.
- Google Translate widget is included under header.