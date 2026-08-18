export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { userId, email } = req.body;

  try {
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
            unit_price: 19.90
          }
        ],
        payer: {
          email: email || 'usuario@exemplo.com'
        },
        external_reference: userId, // Grava o ID do seu usuário para sabermos quem pagou
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
      throw new Error(data.message || 'Erro ao comunicar com Mercado Pago');
    }

    // Retorna o link de checkout (sandbox_init_point para testes ou init_point para produção)
    return res.status(200).json({ 
      init_point: data.init_point, 
      sandbox_init_point: data.sandbox_init_point 
    });
  } catch (error) {
    console.error('Erro na API Mercado Pago:', error);
    return res.status(500).json({ error: error.message });
  }
}