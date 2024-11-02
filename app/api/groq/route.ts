import { Groq } from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Valid message history is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemMessage = {
      role: "system",
      content: "You are an AI technical interviewer assistant. You will receive software engineering interview questions that may range from conceptual to highly technical topics. For every response, start with a 1-2 line 'TLDR:' that captures the key point, then provide your detailed explanation. Provide clear, concise, and accurate responses. For complex technical concepts, include brief explanations. Focus on being direct while ensuring the core concepts are well understood. If code examples are needed, keep them minimal but illustrative."
    };

    const allMessages = [systemMessage, ...messages];

    const completion = await groq.chat.completions.create({
      messages: allMessages,
      model: "llama-3.1-70b-versatile",
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                controller.enqueue(content);
              }
            }
          } catch (error) {
            console.error('Streaming error:', error);
          } finally {
            controller.close();
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response('Failed to process the request. Please try again later.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
} 