// netlify/functions/save-knowledge.js

const admin = require('firebase-admin');

// Carga las credenciales desde las variables de entorno de Netlify
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  // Reemplaza los \\n con saltos de línea reales
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

// Inicializa la app de Firebase solo si no ha sido inicializada antes
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Recibe y parsea los datos enviados desde el juego
    const { knowledgeBook } = JSON.parse(event.body);

    if (!knowledgeBook || !Array.isArray(knowledgeBook)) {
      return { statusCode: 400, body: 'Bad Request: knowledgeBook is missing or not an array.' };
    }
    
    // 2. Crea una operación por lotes (batch) para guardar todos los datos de forma eficiente
    const batch = db.batch();

    // 3. Recorre el array de conocimiento
    knowledgeBook.forEach(([boardKey, moveData]) => {
      // Usa cada 'boardKey' como el ID de un documento separado en la colección 'knowledge'
      const docRef = db.collection('knowledge').doc(boardKey);
      
      // Añade una operación al lote para crear o fusionar los datos en ese documento
      // { merge: true } asegura que si el documento ya existe, solo se actualicen los campos nuevos o modificados
      batch.set(docRef, moveData, { merge: true });
    });

    // 4. Ejecuta todas las operaciones de guardado en la base de datos
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