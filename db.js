const express = require("express");
const app = express();

app.use(express.json());

const documentRoutes = require("./routes/documents");
app.use("/api/documents", documentRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
