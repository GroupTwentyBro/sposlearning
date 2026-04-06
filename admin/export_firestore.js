// export_firestore.js
import admin from "firebase-admin";
import { readFileSync, writeFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./private/service-account.json", "utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function exportCollection(collectionRef) {
    const snapshot = await collectionRef.get();
    const docs = {};

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Recursively export subcollections
        const subcols = await doc.ref.listCollections();
        if (subcols.length > 0) {
            data._subcollections = {};
            for (const subcol of subcols) {
                data._subcollections[subcol.id] = await exportCollection(subcol);
            }
        }

        // Convert Firestore Timestamps to ISO strings
        for (const [k, v] of Object.entries(data)) {
            if (v && typeof v.toDate === "function") data[k] = v.toDate().toISOString();
        }

        docs[doc.id] = data;
    }

    return docs;
}

const collections = await db.listCollections();
const allData = {};

for (const col of collections) {
    console.log(`Exporting: ${col.id}`);
    allData[col.id] = await exportCollection(col);
}

writeFileSync("firestore_export.json", JSON.stringify(allData, null, 2));
console.log("Saved to firestore_export.json");