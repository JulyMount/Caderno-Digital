export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { userId, email, cpf } = bodyData;

    const payerData = {
      email: email || 'comprador@exemplo.com',
    };

    if (cpf) {
      payerData.identification = {
        type: 'CPF',
        number: String(cpf).replace(/\D/g, '')
      };
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        items: [
          {
            title: 'Meu Caderno Digital - Plano Pro (30 dias)',
            quantity: 1,
            currency_id: 'BRL',
            unit_price: 1.00
          }
        ],
        payer: payerData,
        external_reference: userId || 'teste_user',
        notification_url: 'https://caderno-digital-red.vercel.app/api/webhook',
        back_urls: {
          success: 'https://caderno-digital-red.vercel.app/',
          failure: 'https://caderno-digital-red.vercel.app/',
          pending: 'https://caderno-digital-red.vercel.app/'
        },
        auto_return: 'approved'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro da API Mercado Pago:', data);
      return res.status(response.status).json({ error: data.message || 'Erro no Mercado Pago' });
    }

    return res.status(200).json({ 
      init_point: data.init_point, 
      sandbox_init_point: data.sandbox_init_point 
    });
  } catch (error) {
    console.error('Erro interno no servidor:', error);
    return res.status(500).json({ error: error.message });
  }
}