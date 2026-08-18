import admin from 'firebase-admin';

// Trata a chave privada para evitar erros de formatação na Vercel
const formattedPrivateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n')
  : undefined;

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "meu-caderno-digital-4a5f9",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedPrivateKey,
      }),
    });
  } catch (err) {
    console.error('Erro na inicialização do Firebase Admin:', err);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { type, data } = req.body;

    if (type === 'payment' && data?.id) {
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
        }
      });

      const payment = await paymentResponse.json();

      if (payment.status === 'approved') {
        const userId = payment.external_reference;
        console.log(`✅ Pagamento aprovado para o usuário ID: ${userId}`);

        if (userId) {
          const userRef = db.collection('users').doc(userId);
          await userRef.set({ isPro: true }, { merge: true });
          console.log(`🚀 Usuário ${userId} promovido a PRO com sucesso no Firestore!`);
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Erro no Webhook:', error);
    return res.status(500).send('Webhook Error');
  }
}