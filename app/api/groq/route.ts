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
      content: "You are a helpful AI assistant powered by Llama 3.1 70B. Provide clear, accurate, and engaging responses."
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