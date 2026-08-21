export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { userId, email, cpf } = bodyData;

    // Detecta dinamicamente a URL da aplicação
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const currentUrl = `${protocol}://${host}`;

    // Requisição para criar o pagamento transparente via Pix
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        'X-Idempotency-Key': `${userId}_${Date.now()}`
      },
      body: JSON.stringify({
        transaction_amount: 1.00,
        description: 'Meu Caderno Digital - Plano Pro (30 dias)',
        payment_method_id: 'pix',
        payer: {
          email: email || 'comprador@exemplo.com',
          identification: cpf ? {
            type: 'CPF',
            number: String(cpf).replace(/\D/g, '')
          } : undefined
        },
        external_reference: userId || 'teste_user',
        notification_url: `${currentUrl}/api/webhook`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro na API Mercado Pago (Pix):', data);
      return res.status(response.status).json({ error: data.message || 'Erro ao gerar o Pix' });
    }

    // Extrai o QR Code em imagem (Base64) e o código Copia e Cola
    const qrCodeBase64 = data.point_of_interaction?.transaction_data?.qr_code_base64;
    const qrCodeCopyPaste = data.point_of_interaction?.transaction_data?.qr_code;
    const paymentId = data.id;

    return res.status(200).json({
      paymentId,
      qrCodeBase64,
      qrCodeCopyPaste
    });

  } catch (error) {
    console.error('Erro interno no servidor ao criar Pix:', error);
    return res.status(500).json({ error: error.message });
  }
}