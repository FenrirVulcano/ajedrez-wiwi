// netlify/functions/get-knowledge.js

const admin = require('firebase-admin');

// --- Bloque de Inicialización Seguro (Idéntico al de save-knowledge.js) ---

// Verifica que las variables de entorno existan antes de usarlas
if (!process.env.FIREBASE_PRIVATE_KEY) {
  // Este error detendrá la ejecución si las credenciales no están configuradas
  throw new Error("La variable de entorno FIREBASE_PRIVATE_KEY no está configurada.");
}

// Carga las credenciales desde las variables de entorno de Netlify
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

// Inicializa la app de Firebase solo si no ha sido inicializada antes
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// --- Fin del Bloque de Inicialización ---


exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const knowledgeCollection = db.collection('knowledge');
    const snapshot = await knowledgeCollection.get();

    if (snapshot.empty) {
      console.log('No se encontró conocimiento previo.');
      // Devuelve un array vacío si no hay nada en la base de datos
      return {
        statusCode: 200,
        body: JSON.stringify([])
      };
    }
    
    // Convierte los documentos de Firestore al formato que el frontend espera: [ [key, value], [key, value] ]
    const knowledgeData = snapshot.docs.map(doc => [doc.id, doc.data()]);

    return {
      statusCode: 200,
      body: JSON.stringify(knowledgeData),
    };

  } catch (error) {
    console.error("Error al cargar el conocimiento:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Hubo un error interno al cargar los datos." }),
    };
  }
};