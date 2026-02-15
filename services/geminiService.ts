
import { GoogleGenAI } from "@google/genai";
import { Sale, Expense } from "../types";

// Always use process.env.API_KEY directly as a named parameter
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getFinancialInsights(sales: Sale[], expenses: Expense[]) {
  // Using gemini-3-flash-preview for general business analysis tasks
  const model = 'gemini-3-flash-preview';
  
  const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const profit = totalRevenue - totalExpenses;
  
  const prompt = `
    As a business consultant for a boutique Barber Shop, analyze the following financial data:
    Total Revenue: $${totalRevenue}
    Total Expenses: $${totalExpenses}
    Net Profit: $${profit}
    
    Number of Sales: ${sales.length}
    Recent Expenses: ${expenses.slice(0, 5).map(e => `${e.category}: $${e.amount}`).join(', ')}
    
    Please provide:
    1. A short summary of the financial health.
    2. Three actionable tips to increase revenue or reduce costs.
    3. An observation on sales volume vs expenses.
    
    Return the response in a clean, professional format.
  `;

  try {
    // Generate content using the recommended structure
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    // Accessing .text as a property, not a method
    return response.text || "No insights could be generated.";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "Unable to generate insights at this time. Please check your data or try again later.";
  }
}
