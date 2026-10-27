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

    const model = 'gemini-3.8-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const maxRetries = 3;
    let lastErrorMessage = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7500);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(200).json({ text: data.candidates[0].content.parts[0].text });
        }

        lastErrorMessage = data.error?.message || 'Erro na comunicação com a API.';

        // Se o servidor do Google disser que está em alta demanda ou temporariamente indisponível, tenta novamente
        if (attempt < maxRetries && (response.status === 503 || response.status === 429 || lastErrorMessage.includes('demand'))) {
          await sleep(1200);
          continue;
        }

        return res.status(response.status || 500).json({ error: lastErrorMessage });

      } catch (err) {
        if (err.name === 'AbortError') {
          lastErrorMessage = 'O Gemini demorou para responder.';
        } else {
          lastErrorMessage = err.message;
        }

        if (attempt < maxRetries) {
          await sleep(1000);
        }
      }
    }

    return res.status(503).json({ 
      error: `Os servidores do Google estão temporariamente sobrecarregados. Por favor, tente enviar novamente em alguns segundos.` 
    });

  } catch (error) {
    return res.status(500).json({ error: `Erro interno no servidor: ${error.message}` });
  }
}
