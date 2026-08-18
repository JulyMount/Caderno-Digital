export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { type, data } = req.body;

    // O Mercado Pago avisa quando o status de um pagamento é alterado
    if (type === 'payment' && data?.id) {
      // 1. Consulta os detalhes do pagamento na API do Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
        }
      });

      const payment = await paymentResponse.json();

      // 2. Se o pagamento foi aprovado
      if (payment.status === 'approved') {
        const userId = payment.external_reference; // O ID do usuário que enviamos no checkout
        console.log(`✅ Pagamento aprovado com sucesso para o usuário: ${userId}`);

        // O evento foi processado com sucesso
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Erro ao processar Webhook:', error);
    return res.status(500).send('Webhook Error');
  }
}