// Ruta del archivo: netlify/functions/get-knowledge.js

// 1. Importamos la "caja de herramientas" de Firebase que acabamos de instalar.
const admin = require('firebase-admin');

// 2. Leemos la "llave secreta" que guardaste en Netlify en el Paso 4.
//    JSON.parse la convierte de texto plano a un objeto que Firebase entiende.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// 3. Nos conectamos a tu proyecto de Firebase.
//    Esta línea es una seguridad para evitar que se conecte múltiples veces y dé error.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// 4. Obtenemos acceso a la base de datos (Firestore).
const db = admin.firestore();

// 5. Esta es la función principal que se ejecuta cuando el juego la llama.
exports.handler = async (event) => {
    try {
        // 6. Le damos la ruta exacta de los datos que queremos buscar.
        //    Imagina que `aiKnowledge` es un cajón y `knowledgeBook` es una carpeta.
        const docRef = db.collection('aiKnowledge').doc('knowledgeBook');
        const doc = await docRef.get(); // Le decimos: "Trae lo que hay en esa carpeta".

        // 7. Si la "carpeta" (documento) no existe, devolvemos una lista vacía.
        if (!doc.exists) {
            return {
                statusCode: 200,
                body: JSON.stringify([]),
            };
        }

        // 8. Si existe, extraemos los datos y se los enviamos al juego.
        const knowledgeData = doc.data().book;
        return {
            statusCode: 200,
            body: JSON.stringify(knowledgeData),
        };

    } catch (error) {
        // Si algo sale mal, registramos el error.
        console.error('Error al obtener el conocimiento:', error);
        return { statusCode: 500, body: error.toString() };
    }
};