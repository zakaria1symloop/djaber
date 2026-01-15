import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateResponseParams {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  businessContext?: string;
  customInstructions?: string;
  model?: string;
}

export const generateAIResponse = async ({
  conversationHistory,
  businessContext,
  customInstructions,
  model = 'gpt-4',
}: GenerateResponseParams): Promise<string> => {
  try {
    const systemMessage = `You are an AI assistant helping with customer service for a business.
${businessContext ? `Business context: ${businessContext}` : ''}
${customInstructions ? `Custom instructions: ${customInstructions}` : ''}

Guidelines:
- Be helpful, professional, and friendly
- Keep responses concise and clear
- If you don't know something, be honest about it
- Always prioritize customer satisfaction`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        ...conversationHistory,
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('AI generation error:', error);
    throw new Error('Failed to generate AI response');
  }
};

export const moderateContent = async (text: string): Promise<boolean> => {
  try {
    const moderation = await openai.moderations.create({
      input: text,
    });

    return !moderation.results[0]?.flagged;
  } catch (error) {
    console.error('Moderation error:', error);
    return true; // Default to allowing if moderation fails
  }
};
