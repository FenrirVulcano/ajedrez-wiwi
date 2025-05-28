// Ruta del archivo: netlify/functions/save-knowledge.js

// Los primeros 4 pasos son idénticos al otro archivo: nos conectamos a Firebase.
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// 5. Esta es la función principal que se ejecuta cuando el juego quiere guardar.
exports.handler = async (event) => {
    try {
        // 6. Extraemos los datos que el juego nos envía para guardar.
        const knowledgeArray = JSON.parse(event.body).knowledgeBook;

        // 7. Apuntamos a la misma "carpeta" donde queremos guardar los datos.
        const docRef = db.collection('aiKnowledge').doc('knowledgeBook');

        // 8. Guardamos los datos. .set() sobrescribe lo que había antes con la nueva información.
        await docRef.set({ book: knowledgeArray });

        // 9. Respondemos al juego que todo salió bien.
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Conocimiento guardado exitosamente en Firebase' }),
        };

    } catch (error) {
        // Si algo sale mal, registramos el error.
        console.error('Error al guardar el conocimiento:', error);
        return { statusCode: 500, body: error.toString() };
    }
};