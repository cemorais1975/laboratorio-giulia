export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada na Vercel.' });
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Formato de mensagens inválido.' });
    }

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Modelos para tentar em sequência caso um esteja congestionado
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastErrorMessage = '';

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.status(200).json({ text: data.candidates[0].content.parts[0].text });
      }

      lastErrorMessage = data.error?.message || 'Erro na resposta da API.';
      console.warn(`Tentativa com ${model} falhou:`, lastErrorMessage);
    }

    return res.status(503).json({ error: 'Servidores do Google temporariamente ocupados. Tente novamente em alguns instantes.' });

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}
