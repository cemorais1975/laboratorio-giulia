export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave GEMINI_API_KEY não configurada na Vercel.' });
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Payload de mensagens inválido.' });
    }

    // Extrai a instrução do sistema (primeira mensagem) e separa do histórico da conversa
    let systemInstruction = null;
    const contents = [];

    messages.forEach((msg, idx) => {
      if (idx === 0 && msg.role === 'user' && msg.content.includes('Você vai interpretar')) {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    });

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Olá' }] });
    }

    const payload = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    // Endpoint oficial estável da v1beta da API do Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || `Erro HTTP ${response.status}`;
      return res.status(response.status).json({ error: errorMsg });
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) {
      return res.status(500).json({ error: 'Resposta vazia retornada pelo modelo.' });
    }

    return res.status(200).json({ text: replyText });

  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Tempo limite excedido. O servidor do Gemini demorou para responder.' });
    }
    return res.status(500).json({ error: `Erro no servidor: ${error.message}` });
  }
}
