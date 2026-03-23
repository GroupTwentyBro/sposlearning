import mysql from "mysql2/promise";
import { readFileSync } from "fs";

// Load the exported Firestore data
const data = JSON.parse(readFileSync("./firestore_export.json", "utf8"));

const db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Group20*", // <-- Update this!
    database: "spos_learning",
});

// --- admin_pages ---
for (const [docId, doc] of Object.entries(data["admin-pages"] || {})) {
    await db.execute(
        `INSERT INTO admin_pages (page_id, html, lastUpdated) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE html=VALUES(html)`,
        [docId, doc.html || null, doc.lastUpdated ? new Date(doc.lastUpdated) : null]
    );
}
console.log("✓ admin_pages migrated");

// --- pages ---
for (const [docId, doc] of Object.entries(data["pages"] || {})) {
    await db.execute(
        `INSERT INTO pages
      (fullPath, name, path, title, content, accessLevel, createdBy, createdAt, lastEditedBy, lastEditedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE content=VALUES(content)`,
        [
            docId, // Using docId as fullPath per your Primary Key structure
            doc.name || null, doc.path || null, doc.title || null, doc.content || null,
            doc.accessLevel === "admin" ? "admin" : "public",
            doc.createdBy || null, doc.createdAt ? new Date(doc.createdAt) : null,
            doc.lastEditedBy || null, doc.lastEditedAt ? new Date(doc.lastEditedAt) : null,
        ]
    );
}
console.log("✓ pages migrated");

// --- feedback ---
for (const [docId, doc] of Object.entries(data["feedback"] || {})) {
    await db.execute(
        `INSERT INTO feedback
      (id, uid, name, contact, title, message, page, relatedPage, priority, status, resolved, ip, userAgent, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status=VALUES(status), resolved=VALUES(resolved)`,
        [
            docId, doc.uid || null, doc.name || null, doc.contact || null,
            doc.title || null, doc.message || null, doc.page || null, doc.relatedPage || null,
            doc.priority || "low", doc.status || "open", doc.resolved ? 1 : 0,
            doc.ip || null, doc.userAgent || null,
            doc.timestamp ? new Date(doc.timestamp) : new Date(),
        ]
    );
}
console.log("✓ feedback migrated");

await db.end();
console.log("🎉 All Firestore data successfully migrated to MariaDB!");