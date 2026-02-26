const express = require("express");
const router = express.Router();
const db = require("../db");

// Helpers for tags
async function getOrCreateTag(name) {
  const res = await db.query("SELECT id FROM tags WHERE name=$1", [name]);
  if (res.rows.length) return res.rows[0].id;
  const insert = await db.query("INSERT INTO tags(name) VALUES($1) RETURNING id", [name]);
  return insert.rows[0].id;
}

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

// --- Summaries ---
router.post(`/:id/summary`, async (req, res) => {
  const { summary } = req.body;
  await db.query("UPDATE documents SET summary=$1 WHERE id=$2", [summary, req.params.id]);
  res.json({ message: "Summary saved" });
});

router.get(`/:id/summary`, async (req, res) => {
  const result = await db.query("SELECT summary FROM documents WHERE id=$1", [req.params.id]);
  res.json({ summary: result.rows[0] ? result.rows[0].summary : null });
});

// --- Tags ---
router.post(`/:id/tags`, async (req, res) => {
  const { tags } = req.body; // expect array of tag names
  if (!Array.isArray(tags)) return res.status(400).json({ error: "tags must be an array" });

  const added = [];
  for (const t of tags) {
    const tagId = await getOrCreateTag(t.trim().toLowerCase());
    await db.query(
      "INSERT INTO document_tags(document_id, tag_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [req.params.id, tagId]
    );
    added.push(t);
  }

  res.json({ added });
});

router.get(`/:id/tags`, async (req, res) => {
  const result = await db.query(
    `SELECT t.name FROM tags t JOIN document_tags dt ON dt.tag_id = t.id WHERE dt.document_id=$1`,
    [req.params.id]
  );
  res.json({ tags: result.rows.map(r => r.name) });
});

router.get('/search/by-tag/:tag', async (req, res) => {
  const tag = req.params.tag;
  const result = await db.query(
    `SELECT d.* FROM documents d
     JOIN document_tags dt ON dt.document_id = d.id
     JOIN tags t ON t.id = dt.tag_id
     WHERE t.name = $1`,
    [tag]
  );
  res.json({ documents: result.rows });
});

// Save extracted text, summary and tags in one request
router.post('/:id/process', async (req, res) => {
  const { extractedText, summary, tags } = req.body;
  try {
    // Update extracted text and summary
    await db.query(
      'UPDATE documents SET extracted_text=$1, summary=$2, status=$3 WHERE id=$4',
      [extractedText || null, summary || null, 'processed', req.params.id]
    );

    // Handle tags (optional)
    if (Array.isArray(tags) && tags.length) {
      for (const t of tags) {
        const tagId = await getOrCreateTag(t.trim().toLowerCase());
        await db.query(
          'INSERT INTO document_tags(document_id, tag_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [req.params.id, tagId]
        );
      }
    }

    res.json({ message: 'Document processed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process document' });
  }
});
