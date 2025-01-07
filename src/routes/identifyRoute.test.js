const request = require("supertest");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const identifyRoute = require("./identifyRoute");

const app = express();
app.use(express.json());
app.use("/identify", identifyRoute);

const prisma = new PrismaClient();

// Clear the database before each test to ensure isolation
beforeEach(async () => {
  await prisma.contact.deleteMany();
}, 10000); // Optional: Increased timeout if needed

// Disconnect Prisma after all tests are done
afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /identify", () => {
  // Test case for creating a new primary contact
  it("should create a new primary contact", async () => {
    const response = await request(app)
      .post("/identify")
      .send({ email: "test@example.com", phoneNumber: "1234567890" });

    expect(response.status).toBe(200);
    expect(response.body.primaryContactId).toBeDefined();
    expect(response.body.emails).toContain("test@example.com");
    expect(response.body.phoneNumbers).toContain("1234567890");
    expect(response.body.secondaryContactIds).toEqual([]);
  });

  // Test case for creating a secondary contact with a new email
  it("should create a secondary contact for existing primary contact with new email", async () => {
    // Create primary contact first
    const primaryResponse = await request(app)
      .post("/identify")
      .send({ email: "test@example.com", phoneNumber: "1234567890" });

    expect(primaryResponse.status).toBe(200);

    // Create secondary contact with a new email
    const response = await request(app)
      .post("/identify")
      .send({ email: "test4@example.com", phoneNumber: "1234567890" });

    expect(response.status).toBe(200);
    expect(response.body.primaryContactId).toBe(
      primaryResponse.body.primaryContactId
    );
    expect(response.body.emails).toContain("test@example.com");
    expect(response.body.emails).toContain("test4@example.com");
    expect(response.body.phoneNumbers).toContain("1234567890");
    expect(response.body.secondaryContactIds.length).toBe(1);
  });

  // Test case for creating a secondary contact with a new phone number
  it("should create a secondary contact for existing primary contact with new phone number", async () => {
    // Create primary contact first
    const primaryResponse = await request(app)
      .post("/identify")
      .send({ email: "test@example.com", phoneNumber: "1234567890" });

    expect(primaryResponse.status).toBe(200);

    // Create secondary contact with a new phone number
    const response = await request(app)
      .post("/identify")
      .send({ email: "test@example.com", phoneNumber: "0987654321" });

    expect(response.status).toBe(200);
    expect(response.body.primaryContactId).toBe(
      primaryResponse.body.primaryContactId
    );
    expect(response.body.emails).toContain("test@example.com");
    expect(response.body.phoneNumbers).toContain("1234567890");
    expect(response.body.phoneNumbers).toContain("0987654321");
    expect(response.body.secondaryContactIds.length).toBe(1);
  });

  // Test case for creating a new primary contact with completely new data
  it("should create a new primary contact for completely new data", async () => {
    const response = await request(app)
      .post("/identify")
      .send({ email: "test5@example.com", phoneNumber: "1122334455" });

    expect(response.status).toBe(200);
    expect(response.body.primaryContactId).toBeDefined();
    expect(response.body.emails).toContain("test5@example.com");
    expect(response.body.phoneNumbers).toContain("1122334455");
    expect(response.body.secondaryContactIds).toEqual([]);
  });

  // Test case for handling missing email and phone number
  it("should return an error for missing email and phone number", async () => {
    const response = await request(app).post("/identify").send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Email or phone number is required.");
  });

  // Test case for handling multiple secondary contacts correctly
  it("should handle multiple secondary contacts correctly", async () => {
    // Step 1: Create primary contact first
    const primaryResponse = await request(app)
      .post("/identify")
      .send({ email: "test@example.com", phoneNumber: "1234567890" });

    expect(primaryResponse.status).toBe(200);
    const primaryId = primaryResponse.body.primaryContactId;
    expect(primaryId).toBeDefined();

    // Step 2: Create first secondary contact with overlapping phone number
    const response1 = await request(app)
      .post("/identify")
      .send({ email: "test4@example.com", phoneNumber: "1234567890" });

    expect(response1.status).toBe(200);
    expect(response1.body.primaryContactId).toBe(primaryId);
    expect(response1.body.emails).toContain("test@example.com");
    expect(response1.body.emails).toContain("test4@example.com");
    expect(response1.body.phoneNumbers).toContain("1234567890");
    expect(response1.body.secondaryContactIds.length).toBe(1);

    // Step 3: Create second contact with unique email and phone number (should be a new primary)
    const response2 = await request(app)
      .post("/identify")
      .send({ email: "test5@example.com", phoneNumber: "0987654321" });

    expect(response2.status).toBe(200);
    expect(response2.body.primaryContactId).not.toBe(primaryId);
    expect(response2.body.primaryContactId).toBeDefined();
    expect(response2.body.emails).toContain("test5@example.com");
    expect(response2.body.phoneNumbers).toContain("0987654321");
    expect(response2.body.secondaryContactIds).toEqual([]);

    // Step 4: Create third contact with overlapping email of the second primary (should link to response2's primary)
    const response3 = await request(app)
      .post("/identify")
      .send({ email: "test5@example.com", phoneNumber: "5566778899" });

    expect(response3.status).toBe(200);
    expect(response3.body.primaryContactId).toBe(
      response2.body.primaryContactId
    );
    expect(response3.body.emails).toContain("test5@example.com");
    expect(response3.body.phoneNumbers).toContain("5566778899");

    // Additionally, verify that phoneNumbers include both existing and new
    expect(response3.body.phoneNumbers).toContain("0987654321");
    expect(response3.body.phoneNumbers).toContain("5566778899");

    // Verify that secondaryContactIds now includes the new secondary
    expect(response3.body.secondaryContactIds.length).toBe(1);
  }, 10000); // Increased timeout to 10 seconds
});
