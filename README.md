# User Profiler and Recociliation System

## Overview

This User Profiler and Consolidator System is a robust backend service designed to manage and identify contacts based on their email addresses and phone numbers. Utilizing **Express.js** for server management and **Prisma ORM** for database interactions, this system ensures efficient handling of primary and secondary contacts with seamless integration and reliable performance.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)

## Features

- **Contact Identification:** Automatically identifies and categorizes contacts as primary or secondary based on overlapping information.
- **Automated Transformation:** Transforms existing primary contacts into secondary contacts when overlaps are detected.
- **Atomic Transactions:** Ensures data integrity using Prisma's transaction mechanism.
- **Comprehensive Testing:** Includes a suite of tests to validate all functionalities using **Supertest** and **Jest**.

## Technologies Used

- **Node.js:** JavaScript runtime environment.
- **Express.js:** Web framework for building APIs.
- **Prisma ORM:** Database toolkit for type-safe database access.
- **Supertest:** HTTP assertions for testing.
- **Jest:** JavaScript testing framework.
- **Postman:** API development and testing tool.

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/emotorad-contact-id.git
   ```

2. **Navigate to the Project Directory**

   ```bash
   cd emotorad-contact-id
   ```

3. **Install Dependencies**

   ```bash
   npm install
   ```

4. **Set Up Environment Variables**

   Create a [.env](./env) file in the root directory and add your database connection string:

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/emotorad"
   ```

5. **Run Prisma Migrations**

   ```bash
   npx prisma migrate dev --name init
   ```

6. **Start the Server**

   ```bash
   npm start
   ```

   The server will run on `http://localhost:3000` by default.

## Configuration

- **Environment Variables:**

  - `DATABASE_URL`: Connection string for your PostgreSQL database.
  - `PORT`: Port number on which the server will run (default is `3000`).

- **Prisma Schema:**

  ```prisma
  // filepath: /prisma/schema.prisma

  // Initialize the schema with the PostgreSQL provider
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  generator client {
    provider = "prisma-client-js"
  }

  // Define the Contact model
  model Contact {
    id              String   @id @default(uuid())
    email           String?  @unique
    phoneNumber     String?  @unique
    linkPrecedence  String   @default("primary")
    linkedId        String?
    createdAt       DateTime @default(now())
    // Add any other necessary fields
  }
  ```

## Usage

To use the system locally, follow these steps:

1. **Start the Server**

   Ensure the server is running by executing:

   ```bash
   npm run dev
   ```

   or

   ```bash
   npm start
   ```

   The server will run on `http://localhost:3000` by default.

2. **Using Postman**

   - Open Postman.
   - Create a new POST request.
   - Set the URL to `http://localhost:3000/identify`.
   - In the body, select `raw` and `JSON` format.
   - Add the following JSON payload:

     ```json
     {
       "email": "user@example.com",
       "phoneNumber": "1234567890"
     }
     ```

   - Send the request and review the response.

3. **Using cURL**

   Open your terminal and run the following command:

   ```bash
   curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d '{"email": "user@example.com", "phoneNumber": "1234567890"}'
   ```

4. **Using Thunder Client**

   - Open Thunder Client in VS Code.
   - Create a new POST request.
   - Set the URL to `http://localhost:3000/identify`.
   - In the body, select `JSON` format.
   - Add the following JSON payload:

     ```json
     {
       "email": "user@example.com",
       "phoneNumber": "1234567890"
     }
     ```

   - Send the request and review the response.

## API Endpoints

### POST `/identify`

Identifies existing contacts or creates new ones based on the provided email and/or phone number.

**Request Body:**

```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

**Responses:**

- **200 OK**

  ```json
  {
    "primaryContactId": "UUID-1",
    "emails": ["user@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": []
  }
  ```

- **400 Bad Request**

  ```json
  {
    "error": "Email or phone number is required."
  }
  ```

- **500 Internal Server Error**

  ```json
  {
    "error": "Internal server error."
  }
  ```

## Testing

To ensure the robustness of the Emotorad Contact Identification System, a comprehensive suite of tests has been implemented using **Supertest** and **Jest**.

### Running Tests

1. **Install Development Dependencies**

   ```bash
   npm install --save-dev jest supertest
   ```

2. **Run Tests**

   ```bash
   npm test
   ```

### Test Cases

- **Create a new primary contact**
- **Create a secondary contact for existing primary contact with new email**
- **Create a secondary contact for existing primary contact with new phone number**
- **Create a new primary contact for completely new data**
- **Return an error for missing email and phone number**
- **Handle multiple secondary contacts correctly**
