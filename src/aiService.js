// AI Service Module
// Handles all AI API interactions and provider-specific logic

import OpenAI from 'openai';

export function getProviderName(baseURL) {
    if (baseURL.includes('openrouter.ai')) return 'OpenRouter';
    if (baseURL.includes('api.openai.com')) return 'OpenAI';
    if (baseURL.includes('localhost') || baseURL.includes('127.0.0.1')) return 'Local API';
    return 'Custom API';
}

export async function generateAIIdeas(apiKey, baseURL, selectedNodeText) {
    // Create OpenAI client
    const openaiClient = new OpenAI({ 
        apiKey: apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true 
    });
    
    // Construct prompt for AI
    const prompt = `The central idea is: "${selectedNodeText}". Generate 3-5 related concepts or sub-topics that could branch off from this central idea. Present each concept on a new line. Be concise and focused. Each concept should be a clear, actionable idea that expands on or relates to the central concept.`;
    
    console.log('Calling AI API with prompt:', prompt);
    
    // Call AI API
    const completion = await openaiClient.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7
    });
    
    const ideasText = completion.choices[0].message.content;
    console.log('AI response:', ideasText);
    
    // Parse ideas from response
    const ideas = ideasText.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.match(/^\d+\.?\s*$/)) // Remove empty lines and numbers
        .map(line => line.replace(/^\d+\.?\s*/, '').replace(/^-\s*/, '')) // Remove numbering and bullets
        .slice(0, 5); // Limit to 5 ideas
    
    if (ideas.length === 0) {
        throw new Error('No valid ideas generated');
    }
    
    return ideas;
}

export function getErrorMessage(error) {
    let errorMessage = 'Failed to generate AI ideas. ';
    
    if (error.message.includes('API key')) {
        errorMessage += 'Please check your API key.';
    } else if (error.message.includes('quota')) {
        errorMessage += 'API quota exceeded.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage += 'Network error. Please try again.';
    } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
        errorMessage += 'Invalid API key or unauthorized access.';
    } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        errorMessage += 'Rate limit exceeded. Please wait and try again.';
    } else {
        errorMessage += error.message || 'Unknown error occurred.';
    }
    
    return errorMessage;
}