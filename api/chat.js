export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave OPENAI_API_KEY não configurada na Vercel.' });
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Formato de mensagens inválido.' });
    }

    // Converte a instrução do sistema e formata o histórico para o padrão da OpenAI
    const formattedMessages = messages.map((msg, index) => {
      if (index === 0 && msg.role === 'user' && msg.content.includes('Você vai interpretar')) {
        return { role: 'system', content: msg.content };
      }
      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      };
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Erro na comunicação com a OpenAI.'
      });
    }

    const replyText = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ text: replyText });

  } catch (error) {
    return res.status(500).json({ error: `Erro no servidor: ${error.message}` });
  }
}
