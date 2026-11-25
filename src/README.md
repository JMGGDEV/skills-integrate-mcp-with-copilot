# Mergington High School Activities API

A FastAPI application that lets students view extracurricular activities and
lets signed-in teachers manage registrations.

## Features

- View all available extracurricular activities
- View current participants without signing in
- Teacher sign-in for registering and unregistering students
- Teacher credentials stored locally as salted PBKDF2 password hashes

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Create the local teacher credentials file:

   ```sh
   cp src/teachers.example.json src/teachers.json
   ```

   Add each teacher to the `teachers` array with a username and password hash:

   ```json
   {
     "teachers": [
       {
         "username": "teacher-name",
         "password_hash": "pbkdf2_sha256$<salt>$<hash>"
       }
     ]
   }
   ```

   Generate a hash without displaying the password in the terminal:

   ```sh
   python -c 'import getpass, hashlib, secrets; password=getpass.getpass("Teacher password: "); salt=secrets.token_hex(16); digest=hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600000).hex(); print(f"pbkdf2_sha256${salt}${digest}")'
   ```

   `src/teachers.json` is ignored by Git. Do not commit populated teacher
   credentials. The app uses that path by default; set `TEACHER_CREDENTIALS_FILE`
   to use a different file.

3. Run the application:

   ```
   uvicorn src.app:app --reload
   ```

4. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description |
| ------ | ----------------------------------------------------------------- | ----------- |
| GET    | `/activities`                                                     | Public activity details and participant lists |
| GET    | `/auth/session`                                                   | Check whether the current browser has a teacher session |
| POST   | `/auth/login`                                                     | Sign in with a teacher username and password |
| POST   | `/auth/logout`                                                    | Sign out and invalidate the current session |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Teacher-only student registration |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | Teacher-only student removal |

## Data Model

Activities are stored in memory and identified by name. Each activity has a
description, schedule, maximum participant count, and a list of participant
email addresses. Activity data and teacher sessions reset when the server
restarts. For deployments over HTTPS, set `COOKIE_SECURE=true` so the
teacher-session cookie is only sent over secure connections. Use HTTPS for
teacher sign-in outside local development.
