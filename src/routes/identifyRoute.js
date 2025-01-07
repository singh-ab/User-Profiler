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
    // 1. Find contacts that overlap with the provided email or phone number
    const overlappingContacts = await prisma.contact.findMany({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
    });

    if (overlappingContacts.length === 0) {
      // No overlap found; create a new primary contact
      const newPrimary = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary",
        },
      });

      const emails = [];
      const phoneNumbers = [];
      if (newPrimary.email) emails.push(newPrimary.email);
      if (newPrimary.phoneNumber) phoneNumbers.push(newPrimary.phoneNumber);

      return res.status(200).json({
        primaryContactId: newPrimary.id,
        emails,
        phoneNumbers,
        secondaryContactIds: [],
      });
    } else {
      // Overlap exists; find all associated primaries
      const primaryIds = overlappingContacts
        .map((contact) => {
          if (contact.linkPrecedence === "primary") {
            return contact.id;
          } else if (contact.linkedId) {
            return contact.linkedId;
          }
          return null;
        })
        .filter(Boolean);

      // Fetch unique primaries
      const uniquePrimaryIds = [...new Set(primaryIds)];

      // Fetch primary contacts
      const primaryContacts = await prisma.contact.findMany({
        where: {
          id: { in: uniquePrimaryIds },
        },
      });

      if (primaryContacts.length === 0) {
        // Edge Case: Overlapping contacts without a primary
        // Treat as new primary
        const newPrimary = await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: "primary",
          },
        });

        const emails = [];
        const phoneNumbers = [];
        if (newPrimary.email) emails.push(newPrimary.email);
        if (newPrimary.phoneNumber) phoneNumbers.push(newPrimary.phoneNumber);

        return res.status(200).json({
          primaryContactId: newPrimary.id,
          emails,
          phoneNumbers,
          secondaryContactIds: [],
        });
      }

      // Sort primaries by createdAt to find the oldest
      primaryContacts.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      const ultimatePrimary = primaryContacts[0];

      // Check if the new contact overlaps with ultimatePrimary
      const isOverlapping =
        (email && ultimatePrimary.email === email) ||
        (phoneNumber && ultimatePrimary.phoneNumber === phoneNumber);

      if (isOverlapping) {
        // Link as secondary to the ultimate primary
        const newSecondary = await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: "secondary",
            linkedId: ultimatePrimary.id,
          },
        });

        // Collect all related contacts (primary and its secondaries)
        const allRelatedContacts = await prisma.contact.findMany({
          where: {
            OR: [{ id: ultimatePrimary.id }, { linkedId: ultimatePrimary.id }],
          },
        });

        const emails = [
          ...new Set(allRelatedContacts.map((c) => c.email).filter(Boolean)),
        ];
        const phoneNumbers = [
          ...new Set(
            allRelatedContacts.map((c) => c.phoneNumber).filter(Boolean)
          ),
        ];
        const secondaryIds = allRelatedContacts
          .filter((c) => c.linkPrecedence === "secondary")
          .map((c) => c.id);

        return res.status(200).json({
          primaryContactId: ultimatePrimary.id,
          emails,
          phoneNumbers,
          secondaryContactIds: secondaryIds,
        });
      } else {
        // No direct overlap with ultimate primary; create a new primary
        const newPrimary = await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: "primary",
          },
        });

        const emails = [];
        const phoneNumbers = [];
        if (newPrimary.email) emails.push(newPrimary.email);
        if (newPrimary.phoneNumber) phoneNumbers.push(newPrimary.phoneNumber);

        return res.status(200).json({
          primaryContactId: newPrimary.id,
          emails,
          phoneNumbers,
          secondaryContactIds: [],
        });
      }
    }
  } catch (error) {
    console.error("Error Processing Request:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
