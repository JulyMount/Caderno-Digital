import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, updateDoc, setDoc } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "meu-caderno-digital-4a5f9.firebaseapp.com",
  projectId: "meu-caderno-digital-4a5f9",
  storageBucket: "meu-caderno-digital-4a5f9.appspot.com",
  messagingSenderId: "338874136979",
  appId: "1:338874136979:web:a62b80f9ef468c6a0cb398"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

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
          const userRef = doc(db, 'users', userId);
          await setDoc(userRef, { isPro: true }, { merge: true });
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