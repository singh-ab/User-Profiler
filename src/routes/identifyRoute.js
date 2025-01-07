const express = require("express");

// Create a new router instance using Express
const router = express.Router();

// Import PrismaClient from the Prisma ORM package
const { PrismaClient } = require("@prisma/client");

// Instantiate PrismaClient to interact with the database
const prisma = new PrismaClient();

/**
 * @route   POST /identify
 * @desc    Identify or create contacts based on email and/or phone number
 * @access  Public
 */
router.post("/", async (req, res) => {
  // Destructure email and phoneNumber from the request body
  const { email, phoneNumber } = req.body;

  // Edge Case Handling:
  // If both email and phoneNumber are missing, respond with a 400 Bad Request
  if (!email && !phoneNumber) {
    return res
      .status(400) // HTTP status code for bad requests
      .json({ error: "Email or phone number is required." }); // JSON response with error message
  }

  try {
    /**
     * Step 1: Find existing contacts that overlap with the provided email or phone number.
     * This checks if there's any contact already in the database with the same email or phone number.
     */
    const overlappingContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { email }, // Match contacts with the same email
          { phoneNumber }, // Match contacts with the same phone number
        ],
      },
    });

    /**
     * If no overlapping contacts are found, create a new primary contact.
     * A primary contact is an original contact without any linked contacts.
     */
    if (overlappingContacts.length === 0) {
      // Create a new primary contact in the database
      const newPrimary = await prisma.contact.create({
        data: {
          email, // Assign the provided email
          phoneNumber, // Assign the provided phone number
          linkPrecedence: "primary", // Set link precedence to 'primary'
        },
      });

      // Initialize arrays to collect emails and phone numbers for the response
      const emails = [];
      const phoneNumbers = [];

      // Add the new contact's email to the emails array if it exists
      if (newPrimary.email) emails.push(newPrimary.email);

      // Add the new contact's phone number to the phoneNumbers array if it exists
      if (newPrimary.phoneNumber) phoneNumbers.push(newPrimary.phoneNumber);

      /**
       * Respond with the newly created primary contact's details.
       * Since there are no overlapping contacts, there are no secondary contacts.
       */
      return res.status(200).json({
        primaryContactId: newPrimary.id, // ID of the new primary contact
        emails, // Array of emails associated with the contact
        phoneNumbers, // Array of phone numbers associated with the contact
        secondaryContactIds: [], // Empty array as there are no secondary contacts
      });
    } else {
      /**
       * If overlapping contacts are found, determine the ultimate primary contact.
       * The ultimate primary is the oldest primary contact among the overlapping contacts.
       */

      // Extract primary contacts from the overlapping contacts
      const primaryContacts = overlappingContacts
        .map(
          (contact) =>
            contact.linkPrecedence === "primary"
              ? contact // If the contact is primary, include it
              : overlappingContacts.find((c) => c.id === contact.linkedId) // If secondary, find its linked primary
        )
        .filter(Boolean); // Remove any undefined or null values

      // If no primary contacts are found after mapping, treat as creating a new primary contact
      if (primaryContacts.length === 0) {
        // Create a new primary contact since no existing primaries are found
        const newPrimary = await prisma.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: "primary",
          },
        });

        // Initialize arrays for emails and phone numbers
        const emails = [];
        const phoneNumbers = [];

        // Add the new contact's email if it exists
        if (newPrimary.email) emails.push(newPrimary.email);

        // Add the new contact's phone number if it exists
        if (newPrimary.phoneNumber) phoneNumbers.push(newPrimary.phoneNumber);

        // Respond with the new primary contact's details
        return res.status(200).json({
          primaryContactId: newPrimary.id,
          emails,
          phoneNumbers,
          secondaryContactIds: [],
        });
      }

      /**
       * Sort the primary contacts by their creation date to identify the oldest primary contact.
       * The oldest primary contact is considered the ultimate primary.
       */
      primaryContacts.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      // The first contact after sorting is the ultimate primary
      const ultimatePrimary = primaryContacts[0];

      // All other primary contacts are considered overlapping and will be transformed into secondaries
      const otherPrimaries = primaryContacts.slice(1);

      /**
       * Check if the new contact overlaps with the ultimate primary contact.
       * Overlap is defined as having either the same email or the same phone number.
       */
      const isOverlapping =
        (email && ultimatePrimary.email === email) ||
        (phoneNumber && ultimatePrimary.phoneNumber === phoneNumber);

      if (isOverlapping) {
        /**
         * If the new contact overlaps with the ultimate primary, link the new contact as a secondary.
         * Also, transform any other overlapping primary contacts into secondaries linked to the ultimate primary.
         */
        const result = await prisma.$transaction(async (tx) => {
          // 1. Create a new secondary contact linked to the ultimate primary
          const newSecondary = await tx.contact.create({
            data: {
              email, // Assign the provided email
              phoneNumber, // Assign the provided phone number
              linkPrecedence: "secondary", // Set link precedence to 'secondary'
              linkedId: ultimatePrimary.id, // Link to the ultimate primary contact
            },
          });

          /**
           * 2. Update all other overlapping primary contacts to 'secondary' and link them to the ultimate primary.
           * This ensures that all overlapping contacts are consolidated under a single primary contact.
           */
          if (otherPrimaries.length > 0) {
            await Promise.all(
              otherPrimaries.map((primary) =>
                tx.contact.update({
                  where: { id: primary.id }, // Specify which contact to update
                  data: {
                    linkPrecedence: "secondary", // Change precedence to 'secondary'
                    linkedId: ultimatePrimary.id, // Link to the ultimate primary contact
                  },
                })
              )
            );
          }

          /**
           * 3. Retrieve all related contacts (the ultimate primary and its secondaries) to compile the response.
           * This includes the ultimate primary and any contacts linked to it as secondaries.
           */
          const allRelatedContacts = await tx.contact.findMany({
            where: {
              OR: [
                { id: ultimatePrimary.id }, // Include the ultimate primary
                { linkedId: ultimatePrimary.id }, // Include all secondaries linked to the ultimate primary
              ],
            },
          });

          // Aggregate unique emails from all related contacts
          const emailsResponse = [
            ...new Set(allRelatedContacts.map((c) => c.email).filter(Boolean)),
          ];

          // Aggregate unique phone numbers from all related contacts
          const phoneNumbersResponse = [
            ...new Set(
              allRelatedContacts.map((c) => c.phoneNumber).filter(Boolean)
            ),
          ];

          // Extract IDs of all secondary contacts
          const secondaryIdsResponse = allRelatedContacts
            .filter((c) => c.linkPrecedence === "secondary")
            .map((c) => c.id);

          // Return the consolidated contact information
          return {
            primaryContactId: ultimatePrimary.id, // ID of the ultimate primary contact
            emails: emailsResponse, // All associated emails
            phoneNumbers: phoneNumbersResponse, // All associated phone numbers
            secondaryContactIds: secondaryIdsResponse, // IDs of secondary contacts
          };
        });

        // Respond with the consolidated contact information after transformation
        return res.status(200).json(result);
      } else {
        /**
         * If there's no direct overlap with the ultimate primary, perform a transformation:
         * - Create a new primary contact for the new data.
         * - Update the existing ultimate primary to become a secondary linked to the new primary.
         * - Re-link any secondaries to the new primary.
         */
        const result = await prisma.$transaction(async (tx) => {
          // 1. Create a new primary contact with the provided email and phone number
          const newPrimary = await tx.contact.create({
            data: {
              email, // Assign the provided email
              phoneNumber, // Assign the provided phone number
              linkPrecedence: "primary", // Set link precedence to 'primary'
            },
          });

          // 2. Update the existing ultimate primary to become a secondary linked to the new primary
          await tx.contact.update({
            where: { id: ultimatePrimary.id }, // Specify which contact to update
            data: {
              linkPrecedence: "secondary", // Change precedence to 'secondary'
              linkedId: newPrimary.id, // Link to the new primary contact
            },
          });

          /**
           * 3. Update all existing secondaries linked to the old primary to now link to the new primary.
           * This ensures that all related contacts are correctly linked under the new primary.
           */
          await tx.contact.updateMany({
            where: { linkedId: ultimatePrimary.id }, // Specify secondaries linked to the old primary
            data: { linkedId: newPrimary.id }, // Update their linkedId to the new primary's ID
          });

          /**
           * 4. If there are other overlapping primary contacts, transform them into secondaries linked to the new primary.
           * This consolidates all related contacts under the new primary contact.
           */
          if (otherPrimaries.length > 0) {
            await Promise.all(
              otherPrimaries.map((primary) =>
                tx.contact.update({
                  where: { id: primary.id }, // Specify which contact to update
                  data: {
                    linkPrecedence: "secondary", // Change precedence to 'secondary'
                    linkedId: newPrimary.id, // Link to the new primary contact
                  },
                })
              )
            );
          }

          /**
           * 5. Retrieve all related contacts (the new primary and its secondaries) to compile the response.
           * This includes the new primary and any contacts linked to it as secondaries.
           */
          const allRelatedContacts = await tx.contact.findMany({
            where: {
              OR: [
                { id: newPrimary.id }, // Include the new primary
                { linkedId: newPrimary.id }, // Include all secondaries linked to the new primary
              ],
            },
          });

          // Aggregate unique emails from all related contacts
          const emailsResponse = [
            ...new Set(allRelatedContacts.map((c) => c.email).filter(Boolean)),
          ];

          // Aggregate unique phone numbers from all related contacts
          const phoneNumbersResponse = [
            ...new Set(
              allRelatedContacts.map((c) => c.phoneNumber).filter(Boolean)
            ),
          ];

          // Extract IDs of all secondary contacts
          const secondaryIdsResponse = allRelatedContacts
            .filter((c) => c.linkPrecedence === "secondary")
            .map((c) => c.id);

          // Return the consolidated contact information
          return {
            primaryContactId: newPrimary.id, // ID of the new primary contact
            emails: emailsResponse, // All associated emails
            phoneNumbers: phoneNumbersResponse, // All associated phone numbers
            secondaryContactIds: secondaryIdsResponse, // IDs of secondary contacts
          };
        });

        // Respond with the consolidated contact information after transformation
        return res.status(200).json(result);
      }
    }
  } catch (error) {
    /**
     * Error Handling:
     * If any error occurs during the process, log the error and respond with a 500 Internal Server Error.
     */
    console.error("Error Processing Request:", error); // Log the error for debugging
    return res.status(500).json({ error: "Internal server error." }); // Respond with an error message
  }
});

// Export the router to be used in the main application file
module.exports = router;
