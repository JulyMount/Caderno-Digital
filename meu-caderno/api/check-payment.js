import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { paymentId, userId } = req.query;

  if (!paymentId || !userId) {
    return res.status(400).json({ error: 'Parâmetros ausentes' });
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
      }
    });

    const data = await response.json();

    if (data.status === 'approved') {
      // Atualiza o usuário para PRO no Firestore imediatamente
      await db.collection('users').doc(userId).set({
        isPro: true,
        proUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return res.status(200).json({ status: 'approved' });
    }

    return res.status(200).json({ status: data.status });
  } catch (error) {
    console.error('Erro na checagem de pagamento:', error);
    return res.status(500).json({ error: error.message });
  }
}