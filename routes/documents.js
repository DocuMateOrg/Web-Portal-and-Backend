const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/upload", async (req, res) => {
  const { filename, fileUrl, groupId, uploaderId } = req.body;

  const result = await db.query(
    `INSERT INTO documents(filename,file_url,group_id,uploader_id,status)
     VALUES($1,$2,$3,$4,'uploaded') RETURNING *`,
    [filename, fileUrl, groupId, uploaderId]
  );

  res.json(result.rows[0]);
});

router.put("/:id/trash", async (req, res) => {
  await db.query("UPDATE documents SET status='trashed' WHERE id=$1", [
    req.params.id,
  ]);
  res.json({ message: "Trashed" });
});

router.put("/:id/restore", async (req, res) => {
  await db.query("UPDATE documents SET status='processed' WHERE id=$1", [
    req.params.id,
  ]);
  res.json({ message: "Restored" });
});

module.exports = router;
