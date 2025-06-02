// AI Service Module
// Handles all AI API interactions and provider-specific logic

import OpenAI from 'openai';

export function getProviderName(baseURL) {
    if (baseURL.includes('openrouter.ai')) return 'OpenRouter';
    if (baseURL.includes('api.openai.com')) return 'OpenAI';
    if (baseURL.includes('localhost') || baseURL.includes('127.0.0.1')) return 'Local API';
    return 'Custom API';
}

export async function generateAIIdeas(apiKey, baseURL, selectedNodeText, connectedNodes = [], model = null) {
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

    // Use provided model or determine the appropriate model based on provider
    let finalModel = model;
    if (!finalModel) {
        finalModel = "gpt-3.5-turbo"; // Default for OpenAI
        if (baseURL.includes('openrouter.ai')) {
            finalModel = "openai/gpt-4o-mini"; // Use a reliable OpenRouter model
        }
    }

    let extraHeaders = {};
    if (baseURL.includes('openrouter.ai')) {
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

    console.log('🤖 AI Call - Model:', finalModel, 'Provider:', getProviderName(baseURL));
    console.log('💬 Message history:', messages.map(m => m.content));

    // Call AI API
    try {

        const completion = await openaiClient.chat.completions.create({
            model: finalModel,
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

export async function generateAIIdeasMultipleModels(apiKey, baseURL, selectedNodeText, connectedNodes = [], models = [], onModelComplete = null) {
    if (!models || models.length === 0) {
        throw new Error('No models specified');
    }

    const trimmedModels = models.map(m => m.trim()).filter(m => m.length > 0);

    if (trimmedModels.length === 0) {
        throw new Error('No valid models specified');
    }

    console.log(`🚀 Starting parallel generation with ${trimmedModels.length} models:`, trimmedModels);

    // Create promises for all models to run in parallel
    const modelPromises = trimmedModels.map(async (model) => {
        try {
            console.log(`🤖 Starting generation with model: ${model}`);
            const ideas = await generateAIIdeas(apiKey, baseURL, selectedNodeText, connectedNodes, model);

            const result = {
                model: model,
                ideas: ideas,
                success: true,
                timestamp: Date.now()
            };

            // Call the callback immediately when this model completes
            if (onModelComplete && typeof onModelComplete === 'function') {
                try {
                    await onModelComplete(result);
                } catch (callbackError) {
                    console.error(`❌ Error in onModelComplete callback for ${model}:`, callbackError);
                }
            }

            console.log(`✅ Completed generation with model: ${model}`);
            return result;
        } catch (error) {
            console.error(`❌ Error with model ${model}:`, error.message);

            const result = {
                model: model,
                ideas: [`Error with ${model}: ${error.message}`],
                success: false,
                error: true,
                errorMessage: error.message,
                timestamp: Date.now()
            };

            // Call the callback even for errors
            if (onModelComplete && typeof onModelComplete === 'function') {
                try {
                    await onModelComplete(result);
                } catch (callbackError) {
                    console.error(`❌ Error in onModelComplete callback for ${model}:`, callbackError);
                }
            }

            return result;
        }
    });

    // Wait for all models to complete (or fail)
    const results = await Promise.allSettled(modelPromises);

    // Extract the actual results from Promise.allSettled
    const finalResults = results.map(result => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            // This should rarely happen since we handle errors inside the promise
            console.error('❌ Unexpected promise rejection:', result.reason);
            return {
                model: 'unknown',
                ideas: [`Unexpected error: ${result.reason?.message || 'Unknown error'}`],
                success: false,
                error: true,
                errorMessage: result.reason?.message || 'Unknown error',
                timestamp: Date.now()
            };
        }
    });

    const successCount = finalResults.filter(r => r.success).length;
    const errorCount = finalResults.filter(r => !r.success).length;

    console.log(`🏁 Parallel generation completed: ${successCount} successful, ${errorCount} failed`);

    return finalResults;
}