import { Groq } from "groq-sdk";

type GroqMessageParam = {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

type ChatMode = 'software' | 'notetaking' | 'research' | 'general';

const SYSTEM_PROMPTS: Record<ChatMode, string> = {
  software: "You are an AI technical interviewer assistant. You will receive software engineering interview questions that may range from conceptual to highly technical topics. For every response, start with a 1-2 line 'TLDR:' that captures the key point, then provide your detailed explanation. Provide clear, concise, and accurate responses. For complex technical concepts, include brief explanations. Focus on being direct while ensuring the core concepts are well understood. If code examples are needed, keep them minimal but illustrative.",
  notetaking: "You are an AI note-taking assistant. Help users organize, summarize, and structure their thoughts and information. For every response, start with a 1-2 line 'TLDR:' summary. Focus on clarity, structure, and highlighting key points. Suggest ways to better organize information when relevant.",
  research: "You are an AI research assistant. Help users explore topics deeply, find relevant information, and understand complex subjects. For every response, start with a 1-2 line 'TLDR:' summary. Provide well-structured explanations with citations when possible. Break down complex topics into digestible parts.",
  general: "You are a helpful AI assistant. For every response, start with a 1-2 line 'TLDR:' summary, then provide clear and informative explanations. Focus on being direct while ensuring concepts are well understood."
};

export async function POST(request: Request) {
  try {
    const { messages, mode = 'general' } = await request.json() as { messages: GroqMessageParam[]; mode: ChatMode };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Valid message history is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemMessage: GroqMessageParam = {
      role: "system",
      content: SYSTEM_PROMPTS[mode]
    };

    // Get the last 4 messages from the chat history
    const recentMessages = messages.slice(-4);

    // Combine system message with recent messages
    const contextMessages: GroqMessageParam[] = [systemMessage, ...recentMessages];

    const completion = await groq.chat.completions.create({
      messages: contextMessages,
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