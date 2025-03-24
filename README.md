
## Description

This is a To-do application built with the [Nest](https://github.com/nestjs/nest) framework. It supports user authentication with Firebase and JWT, task management, and push notifications using Firebase Cloud Messaging (FCM).

## Prerequisites
- Node.js and npm installed
- Docker and Docker Compose installed
- PostgreSQL database
- Redis server
- Firebase project setup with FCM enabled

## Environment Variables

Create a `.env` file in the root directory and add the following environment variables:

```env
DATABASE_URL=postgresql://user:password@db:5432/todo_db
JWT_SECRET=your_jwt_secret
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
FIREBASE_APP_ID=your_firebase_app_id
FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id
REDIS_HOST=redis_container
REDIS_PORT=6379
```

## Features

- **User Authentication**:
  - **Two Authentication Methods**:
    - **Manual Authentication**: Sign up and sign in with email and password.
    - **Firebase Authentication**: Sign up and sign in using Firebase Authentication.
  - JWT-based authentication for secure API access.
  - Password change and logout functionality.
  - Refresh token support for maintaining user sessions.

- **Task Management**:
  - Create, read, update, and delete tasks.
  - Set task `due dates` and `reminders`.
  - Support for task priorities (`important/none`) and statuses (`completed/none`).
  - Recurring tasks with options for `daily`, `weekly`, `monthly`, and `yearly` repeats.

- **Push Notifications**:
  - BullMQ send push notifications using Firebase Cloud Messaging (FCM).
  - Notification one-time reminder or recurring reminders for tasks.

- **Database Integration**:
  - Integration with PostgreSQL using Prisma ORM.
  - Store user and task data securely.
  - Support for migrations and schema management.

- **Job Queue Management**:
  - Use Redis and BullMQ for job queue management.
  - Schedule and process background jobs for sending notifications.
  - Handle recurring jobs for task reminders.

## Project setup

```bash
$ npm install
```

## Running the app with Docker

When running the app with Docker, all necessary services including Redis, PostgreSQL, and the backend will be deployed.

```bash
# Build and run the containers
$ docker compose -f 'docker-compose.yml' up -d --build 
```

This command will:
- Build the Docker images for the backend.
- Start the PostgreSQL database container.
- Start the BullMQ(Redis-based job queue) server container.
- Start the backend container.


## API Endpoints

### Authentication

- `POST /auth/signup` - Sign up with email and password
- `POST /auth/signin` - Sign in with email and password
- `POST /auth/firebase-signup` - Sign up with Firebase
- `POST /auth/firebase-signin` - Sign in with Firebase
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/change-password` - Change password (protected)
- `POST /auth/logout` - Logout (protected)
- `PATCH /auth/update-fcm-token` - Update FCM token (protected)

### Users

- `GET /users/me` - Get current user info (protected)
- `PATCH /users/me` - Update current user info (protected)
- `DELETE /users/me` - Delete current user (protected)

### Tasks

- `POST /tasks` - Create a new task (protected)
- `GET /tasks` - Get all tasks for the authenticated user (protected)
- `GET /tasks/:taskId` - Get a single task by ID (protected)
- `PATCH /tasks/:taskId` - Update a task by ID (protected)
- `DELETE /tasks/:taskId` - Delete a task by ID (protected)

## Frontend Integration

To enable notifications and fetch the device token, you can use the frontend application available [here](https://github.com/Linh-0v0/to-do-app-fe). The frontend application will handle the process of obtaining the device token from Firebase.

### Steps to Enable Notifications

1. **Fetch Device Token**:
   - Use the frontend application to fetch the device token from Firebase.

2. **Update FCM Token**:
   - Send the device token to the backend using the `PATCH /auth/update-fcm-token` API endpoint.

3. **Receive Notifications**:
   - Once the device token is updated, the backend will use this token to send push notifications for task reminders.

**Important**: Make sure to follow these steps to ensure that notifications are enabled and the device token is updated correctly.

## Flow

### Authentication and Task Creation Flow

1. **User Sends Request**:
   - The user sends a request to create a task, including the JWT in the Authorization header.

2. **JwtAuthGuard**:
   - The `JwtAuthGuards the request to check if the user is authenticated.
   - It extracts the JWT from the Authorization header.
   - It first tries to verify the token using Firebase Authentication.
   - If Firebase verification fails, it falls back to manual JWT verification using the `JwtService`.
   - If the token is valid, the user information is appended to the request object.

3. **Task Controller**:
   - The request is forwarded to the Task Controller.
   - The controller receives the user ID and task data (DTO) from the request.

4. **Task Service**:
   - The controller calls the Task Service with the task data.
   - The Task Service validates the task data and prepares the payload for the repository.

5. **Task Repository**:
   - The Task Service sends the payload to the Task Repository.
   - The Task Repository saves the new task to the database.

6. **BullMQ and Worker**:
   - The Task Repository sends a request to a worker to add data to a queue for sending email notifications.
   - The worker processes the queue and sends the email notifications.
   - The worker also removes the key in Redis after processing.


### Visual Representation

Here's a visual representation of the flow:

```plaintext
User
  |
  |---> Sends create task request with JWT
  |
JwtAuthGuard
  |
  |---> Extracts and verifies JWT
  |     |
  |     |---> Firebase Authentication
  |     |     |
  |     |     |---> Success: Append user to request
  |     |     |
  |     |     |---> Failure: Fallback to manual JWT verification
  |     |
  |     |---> Manual JWT Verification
  |           |
  |           |---> Success: Append user to request
  |           |
  |           |---> Failure: UnauthorizedException
  |
Task Controller
  |
  |---> Receives user ID and task data (DTO)
  |
Task Service
  |
  |---> Validates task data
  |---> Prepares payload for repository
  |
Task Repository
  |
  |---> Saves new task to database
  |---> Sends request to worker for email notifications
  |
Worker
  |
  |---> Processes queue and sends email notifications
  |---> Removes key in Redis after processing
```
