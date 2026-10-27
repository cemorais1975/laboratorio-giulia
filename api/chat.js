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

    // Payload otimizado para gerar respostas mais ágeis e gastar menos cota
    const payload = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600
      }
    };

    const models = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError = '';

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8500);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(200).json({ text: data.candidates[0].content.parts[0].text });
        }

        if (data.error?.message) {
          lastError = data.error.message;
        }
      } catch (err) {
        lastError = err.name === 'AbortError' ? 'Tempo limite atingido' : err.message;
      }
    }

    return res.status(503).json({
      error: 'Os servidores gratuitos do Gemini estão temporariamente sobrecarregados. Aguarde 10 segundos e tente novamente.'
    });

  } catch (error) {
    return res.status(500).json({ error: `Erro interno no servidor: ${error.message}` });
  }
}
