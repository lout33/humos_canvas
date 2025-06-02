// AI Service Module
// Handles all AI API interactions and provider-specific logic

import OpenAI from 'openai';

export function getProviderName(baseURL) {
    if (baseURL.includes('openrouter.ai')) return 'OpenRouter';
    if (baseURL.includes('api.openai.com')) return 'OpenAI';
    if (baseURL.includes('localhost') || baseURL.includes('127.0.0.1')) return 'Local API';
    return 'Custom API';
}

export async function generateAIIdeas(apiKey, baseURL, selectedNodeText, connectedNodes = []) {
    // Validate inputs
    if (!apiKey || apiKey.trim() === '') {
        throw new Error('API key is required');
    }

    if (!baseURL || baseURL.trim() === '') {
        throw new Error('Base URL is required');
    }

    // Check for common API key/provider mismatches
    if (baseURL.includes('openrouter.ai') && apiKey.startsWith('sk-proj-')) {
        throw new Error('You are using an OpenAI API key with OpenRouter. Please either:\n1. Change Base URL to: https://api.openai.com/v1\n2. Or get an OpenRouter API key from openrouter.ai');
    }

    if (baseURL.includes('api.openai.com') && apiKey.startsWith('sk-or-')) {
        throw new Error('You are using an OpenRouter API key with OpenAI. Please either:\n1. Change Base URL to: https://openrouter.ai/api/v1\n2. Or use your OpenAI API key instead');
    }

    // Determine the appropriate model based on provider
    let model = "gpt-3.5-turbo"; // Default for OpenAI
    let extraHeaders = {};

    if (baseURL.includes('openrouter.ai')) {
        model = "openai/gpt-4o-mini"; // Use a reliable OpenRouter model
        extraHeaders = {
            "HTTP-Referer": window.location.origin,
            "X-Title": "Infinite Canvas AI"
        };
    }



    // Create OpenAI client
    const openaiClient = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true,
        defaultHeaders: extraHeaders
    });

    // Construct messages array with connected nodes as conversation history
    let messages = [];

    if (connectedNodes && connectedNodes.length > 0) {
        // Add connected nodes as previous messages in the conversation
        connectedNodes.forEach(node => {
            messages.push({ role: "user", content: node.text });
        });
        console.log('📎 Using', connectedNodes.length, 'connected nodes as conversation history');
    } else {
        console.log('📝 No connected nodes, starting new conversation');
    }

    // Add the current selected node as the latest message
    messages.push({ role: "user", content: selectedNodeText });

    console.log('🤖 AI Call - Model:', model, 'Provider:', getProviderName(baseURL));
    console.log('💬 Message history:', messages.map(m => m.content));

    // Call AI API
    try {

        const completion = await openaiClient.chat.completions.create({
            model: model,
            messages: messages,
            temperature: 0.7
        });

        const responseText = completion.choices[0].message.content;
        console.log('✅ AI response:', responseText);

        // Return the AI response as a single idea (one node)
        const trimmedResponse = responseText.trim();

        if (!trimmedResponse) {
            throw new Error('AI generated empty response');
        }

        return [trimmedResponse]; // Always return as array with single item
    } catch (apiError) {
        console.error('❌ AI API Error:', apiError.message);

        // Re-throw the error to be handled by the calling function
        throw apiError;
    }
}

export function getErrorMessage(error) {
    let errorMessage = 'Failed to generate AI ideas. ';

    // Check for specific error patterns
    const errorString = error.message || JSON.stringify(error) || '';

    if (errorString.includes('No auth credentials found') || errorString.includes('401')) {
        errorMessage += 'Authentication failed. Please check your API key and make sure it\'s valid for the selected provider.';
    } else if (errorString.includes('API key')) {
        errorMessage += 'Please check your API key.';
    } else if (errorString.includes('quota') || errorString.includes('insufficient_quota')) {
        errorMessage += 'API quota exceeded.';
    } else if (errorString.includes('network') || errorString.includes('fetch')) {
        errorMessage += 'Network error. Please try again.';
    } else if (errorString.includes('unauthorized')) {
        errorMessage += 'Invalid API key or unauthorized access.';
    } else if (errorString.includes('429') || errorString.includes('rate limit')) {
        errorMessage += 'Rate limit exceeded. Please wait and try again.';
    } else if (errorString.includes('model') && errorString.includes('not found')) {
        errorMessage += 'The requested model is not available. Please try a different model.';
    } else {
        errorMessage += errorString || 'Unknown error occurred.';
    }

    return errorMessage;
}