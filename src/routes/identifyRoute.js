const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  const { email, phoneNumber } = req.body;

  // Edge Case: Missing Email and Phone Number
  if (!email && !phoneNumber) {
    return res
      .status(400)
      .json({ error: "Email or phone number is required." });
  }

  try {
    const existingContacts = await prisma.contact.findMany({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
    });

    let primaryContactId;
    let emails = [];
    let phoneNumbers = [];
    let secondaryIds = [];

    if (existingContacts.length === 0) {
      // Edge Case: New Contact Creation
      const newPrimary = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary",
        },
      });
      primaryContactId = newPrimary.id;
      emails = [newPrimary.email].filter(Boolean);
      phoneNumbers = [newPrimary.phoneNumber].filter(Boolean);
    } else {
      // Consolidate existing contact information
      const primaryContact =
        existingContacts.find((c) => c.linkPrecedence === "primary") ||
        existingContacts[0];

      primaryContactId = primaryContact.id;
      emails = [
        ...new Set(existingContacts.map((c) => c.email).filter(Boolean)),
      ];
      phoneNumbers = [
        ...new Set(existingContacts.map((c) => c.phoneNumber).filter(Boolean)),
      ];
      secondaryIds = existingContacts
        .filter((c) => c.id !== primaryContactId)
        .map((c) => c.id);

      // Edge Case: Secondary Contact Creation
      const newEmailNeeded = email && !emails.includes(email);
      const newPhoneNeeded = phoneNumber && !phoneNumbers.includes(phoneNumber);
      if (newEmailNeeded || newPhoneNeeded) {
        const secondary = await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: "secondary",
            linkedId: primaryContactId,
          },
        });
        secondaryIds.push(secondary.id);
        if (newEmailNeeded) emails.push(email);
        if (newPhoneNeeded) phoneNumbers.push(phoneNumber);
      }
    }

    // Return consolidated contact information
    return res.status(200).json({
      primaryContactId,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaryIds,
    });
  } catch (error) {
    // Edge Case: Database Errors
    console.error(error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
