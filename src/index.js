const express = require("express");
const { PrismaClient } = require("@prisma/client");
const identifyRoute = require("./routes/identifyRoute");

const app = express();
app.use(express.json());

// Basic health check
app.get("/", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.use("/identify", identifyRoute);

// Start listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
