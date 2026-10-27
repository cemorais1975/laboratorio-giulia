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

    // Nomes oficiais e ativos na API Gemini v1beta
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
    const errors = [];

    for (const model of models) {
      try {
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

        if (data.error?.message) {
          errors.push(`[${model}]: ${data.error.message}`);
        } else {
          errors.push(`[${model}]: Erro HTTP ${response.status}`);
        }
      } catch (err) {
        errors.push(`[${model}]: ${err.message}`);
      }
    }

    return res.status(500).json({ 
      error: `Falha na conexão com a API:\n${errors.join(' | ')}` 
    });

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}
