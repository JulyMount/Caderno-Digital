export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { userId, email, cpf } = req.body;

  try {
    // Monta o objeto payer básico com e-mail
    const payerData = {
      email: email || 'comprador@exemplo.com',
    };

    // Se o CPF for enviado, adiciona a identificação necessária para liberar o Pix sem conta
    if (cpf) {
      payerData.identification = {
        type: 'CPF',
        number: 'cpf.replace(/\D/g, '')' // Remove pontos e hífens, deixando apenas números
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
            unit_price: 1.00 // Valor de R$ 1,00 para o teste de ponta a ponta
          }
        ],
        payer: payerData,
        external_reference: userId, // Grava o ID do usuário para sabermos quem pagou no Webhook
        back_urls: {
          success: 'https://caderno-digital-red.vercel.app/?status=success',
          failure: 'https://caderno-digital-red.vercel.app/?status=failure',
          pending: 'https://caderno-digital-red.vercel.app/?status=pending'
        },
        auto_return: 'approved'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resposta de erro do Mercado Pago:', data);
      throw new Error(data.message || 'Erro ao comunicar com Mercado Pago');
    }

    // Retorna o link oficial de produção e o de sandbox
    return res.status(200).json({ 
      init_point: data.init_point, 
      sandbox_init_point: data.sandbox_init_point 
    });
  } catch (error) {
    console.error('Erro na API Mercado Pago:', error);
    return res.status(500).json({ error: error.message });
  }
}