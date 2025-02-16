import OpenAI from "openai";
import { KnowledgeBase } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatGPTFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export async function executeFunction(
  functionEntry: KnowledgeBase,
  parameters: Record<string, any>
): Promise<any> {
  if (!functionEntry.functionParameters) {
    throw new Error("No function parameters defined");
  }

  const messages = [
    {
      role: "system" as const,
      content: `You are a function that ${functionEntry.functionParameters.description}. 
                Execute the function with the provided parameters and return the result.`,
    },
    {
      role: "user" as const,
      content: `Execute the function with these parameters: ${JSON.stringify(parameters)}`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: functionEntry.chatgptVersion,
    messages,
    functions: [
      {
        name: functionEntry.functionParameters.name,
        description: functionEntry.functionParameters.description,
        parameters: functionEntry.functionParameters.parameters,
      },
    ],
    function_call: { name: functionEntry.functionParameters.name },
  });

  const functionCall = response.choices[0].message.function_call;
  if (!functionCall) {
    throw new Error("No function call in response");
  }

  return JSON.parse(functionCall.arguments);
}

export async function validateFunctionDefinition(
  functionDef: ChatGPTFunction
): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Test the function definition with OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: "Test this function definition",
        },
      ],
      functions: [functionDef],
      function_call: { name: functionDef.name },
    });

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function getKnowledgeBaseResponse(
  entry: KnowledgeBase,
  query: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: entry.chatgptVersion,
    messages: [
      {
        role: "system",
        content: `Use this knowledge base entry to help answer questions: ${entry.content}`,
      },
      {
        role: "user",
        content: query,
      },
    ],
  });

  return response.choices[0].message.content || "No response generated";
}
