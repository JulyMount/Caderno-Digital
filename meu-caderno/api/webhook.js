import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicialização segura do Firebase Admin
function getAdminDb() {
  if (getApps().length === 0) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      console.error('❌ ERRO: FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY não foram encontradas na Vercel!');
      return null;
    }

    // Trata quebras de linha e aspas extras
    privateKey = privateKey.replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId: "meu-caderno-digital-4a5f9",
        clientEmail: clientEmail,
        privateKey: privateKey,
      }),
    });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const db = getAdminDb();

    if (!db) {
      return res.status(500).json({ error: 'Configuração do Firebase Admin pendente na Vercel.' });
    }

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