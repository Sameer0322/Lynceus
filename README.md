# Examination Portal

An online examination system with separate Admin and Student modules, built with a React frontend and Spring Boot backend.

## Tech Stack

**Frontend**
- React 18, React Router v6
- Tailwind CSS
- Vite
- Axios, Recharts

**Backend**
- Java 17, Spring Boot
- Spring Security + JWT authentication
- Spring Data JPA, Hibernate
- MySQL

## Features

- Role-based access (Admin / Student)
- Admin: manage subjects, tests, and questions
- Student: attempt exams and view results
- Email notifications via Gmail SMTP
- JWT-based authentication

## Getting Started

### Prerequisites
- Node.js
- Java 17+
- MySQL

### Backend Setup

1. Create the database:
   ```bash
   mysql -u root -p < database/schema.sql
   ```

2. Copy the example config and fill in your credentials:
   ```bash
   cp backend/src/main/resources/application.properties.example backend/src/main/resources/application.properties
   ```

3. Run the backend:
   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173` and the API at `http://localhost:8080/api`.
