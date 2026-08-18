export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { type, data } = req.body;

    if (type === 'payment' && data?.id) {
      // 1. Busca os detalhes do pagamento no Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
        }
      });

      const payment = await paymentResponse.json();

      // 2. Se aprovado, extrai o ID do usuário que enviamos na criação
      if (payment.status === 'approved') {
        const userId = payment.external_reference;
        console.log(`✅ Pagamento aprovado para o usuário ID: ${userId}`);

        // O evento foi recebido e processado com sucesso
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Erro no Webhook:', error);
    return res.status(500).send('Webhook Error');
  }
}