const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const folderPath = './firestore/admin-pages/';

async function uploadHtmlFiles() {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        if (path.extname(file) === '.html') {
            const filePath = path.join(folderPath, file);
            const rawHtml = fs.readFileSync(filePath, 'utf8');

            const $ = cheerio.load(rawHtml);

            // Get ONLY the content inside #secure
            const finalHtml = $('#secure').html();

            if (!finalHtml) {
                console.warn(`Warning: No #secure div found in ${file}. Skipping.`);
                continue;
            }

            const docId = path.parse(file).name;

            await db.collection('admin-pages').doc(docId).set({
                html: finalHtml.trim(), // trim removes extra whitespace/newlines
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`Uploaded content from inside #secure for: ${docId}`);
        }
    }
}

uploadHtmlFiles().catch(console.error);