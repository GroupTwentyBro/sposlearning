const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function renameCollection(oldPath, newPath) {
    const oldRef = db.collection(oldPath);
    const newRef = db.collection(newPath);
    const snapshots = await oldRef.get();

    const batch = db.batch();

    snapshots.forEach(doc => {
        const newDocRef = newRef.doc(doc.id);
        batch.set(newDocRef, doc.data());
        batch.delete(doc.ref); // Deletes the old record
    });

    await batch.commit();
    console.log(`Moved all documents from ${oldPath} to ${newPath}`);
}

renameCollection('users', 'administrators');