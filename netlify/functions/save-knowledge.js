// netlify/functions/save-knowledge.js
const admin = require('firebase-admin');

// Verifica que las variables de entorno existan antes de usarlas
if (!process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error("La variable de entorno FIREBASE_PRIVATE_KEY no está configurada.");
}

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  // ... (el resto del código de la función no cambia)
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { knowledgeBook } = JSON.parse(event.body);

    if (!knowledgeBook || !Array.isArray(knowledgeBook)) {
      return { statusCode: 400, body: 'Bad Request: knowledgeBook is missing or not an array.' };
    }
    
    const batch = db.batch();

    knowledgeBook.forEach(([boardKey, moveData]) => {
      const docRef = db.collection('knowledge').doc(boardKey);
      batch.set(docRef, moveData, { merge: true });
    });

    await batch.commit();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Conocimiento guardado exitosamente." }),
    };

  } catch (error) {
    console.error("Error al guardar el conocimiento:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Hubo un error interno al guardar los datos." }),
    };
  }
};