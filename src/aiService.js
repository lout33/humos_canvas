// AI Service Module
// Handles all AI API interactions and provider-specific logic

import OpenAI from 'openai';

export function getProviderName(baseURL) {
    if (!baseURL) return 'Demo Mode (Groq)';
    if (baseURL.includes('openrouter.ai')) return 'OpenRouter';
    if (baseURL.includes('api.openai.com')) return 'OpenAI';
    if (baseURL.includes('api.groq.com')) return 'Groq';
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

// ============================================================================
// GROQ API FUNCTIONS (Demo Mode - Free, Ultra-Fast Inference)
// ============================================================================

// Demo Groq API key for public use (free tier)
const DEMO_GROQ_API_KEY = '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';

export async function generateAIIdeasGroq(selectedNodeText, connectedNodes = [], model = 'llama-3.3-70b-versatile') {
    console.log('🎯 Using Groq Demo Mode');
    console.log('🤖 Model:', model);

    // Demo API key is now configured, proceed with Groq API

    // Construct messages array with connected nodes as conversation history
    let messages = [];

    if (connectedNodes && connectedNodes.length > 0) {
        // Add connected nodes as previous messages in the conversation
        connectedNodes.forEach(node => {
            messages.push({ role: "user", content: node.text });
        });
        console.log('📎 Using', connectedNodes.length, 'connected nodes as conversation history');
    }

    // Add the current selected node as the latest message
    messages.push({ role: "user", content: selectedNodeText });

    console.log('💬 Message history:', messages.map(m => m.content));

    try {
        // Create OpenAI client configured for Groq
        const groqClient = new OpenAI({
            apiKey: DEMO_GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1',
            dangerouslyAllowBrowser: true
        });

        console.log('🚀 Calling Groq API...');

        const completion = await groqClient.chat.completions.create({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 150
        });

        const responseText = completion.choices[0].message.content;
        console.log('✅ Groq response:', responseText);

        // Return the AI response as a single idea (one node)
        const trimmedResponse = responseText.trim();

        if (!trimmedResponse) {
            throw new Error('Groq generated empty response');
        }

        return [trimmedResponse]; // Always return as array with single item

    } catch (apiError) {
        console.error('❌ Groq API Error:', apiError.message);

        // Fallback to mock response if API fails
        console.log('🔄 Falling back to mock response...');
        return generateMockResponse(selectedNodeText, model);
    }
}

// Fallback function for when Groq API is not available
function generateMockResponse(selectedNodeText, model) {
    const modelName = model.toLowerCase();
    const input = selectedNodeText.toLowerCase();

    // Generate contextual mock responses
    let responses = [];

    if (modelName.includes('llama')) {
        responses = [
            `Building on "${selectedNodeText.substring(0, 30)}...", here's an expanded perspective from Llama 3.3.`,
            `Your idea about "${selectedNodeText.substring(0, 25)}..." could be developed further with advanced reasoning.`,
            `Considering "${selectedNodeText.substring(0, 20)}...", what about exploring related concepts with deeper analysis?`
        ];
    } else if (modelName.includes('mixtral')) {
        responses = [
            `From multiple angles: "${selectedNodeText.substring(0, 30)}..." presents interesting opportunities.`,
            `Analyzing "${selectedNodeText.substring(0, 25)}..." from different perspectives reveals new insights.`,
            `Your concept "${selectedNodeText.substring(0, 20)}..." could benefit from diverse viewpoints.`
        ];
    } else if (modelName.includes('gemma')) {
        responses = [
            `Thoughtfully considering "${selectedNodeText.substring(0, 30)}...", here are some insights.`,
            `Reflecting on "${selectedNodeText.substring(0, 25)}...", this could lead to interesting developments.`,
            `Your idea "${selectedNodeText.substring(0, 20)}..." has potential for creative expansion.`
        ];
    }

    // Add topic-specific responses
    if (input.includes('business') || input.includes('startup')) {
        responses.push('Consider market validation and competitive analysis for this business concept.');
    } else if (input.includes('technology') || input.includes('software')) {
        responses.push('Technical implementation and scalability are key factors to consider.');
    } else if (input.includes('creative') || input.includes('art')) {
        responses.push('Explore different artistic mediums and creative approaches for this idea.');
    } else {
        responses.push('This concept has potential for further development and exploration.');
    }

    const responseText = responses[Math.floor(Math.random() * responses.length)];
    console.log('✅ Mock response generated:', responseText);
    return [responseText];
}

export async function generateAIIdeasMultipleModelsGroq(selectedNodeText, connectedNodes = [], models = [], onModelComplete = null) {
    if (!models || models.length === 0) {
        throw new Error('No models specified');
    }

    const trimmedModels = models.map(m => m.trim()).filter(m => m.length > 0);

    if (trimmedModels.length === 0) {
        throw new Error('No valid models specified');
    }

    console.log(`🚀 Starting parallel Groq generation with ${trimmedModels.length} models:`, trimmedModels);

    // Create promises for all models to run in parallel
    const modelPromises = trimmedModels.map(async (model) => {
        try {
            console.log(`🤖 Starting Groq generation with model: ${model}`);
            const ideas = await generateAIIdeasGroq(selectedNodeText, connectedNodes, model);

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

            console.log(`✅ Completed Groq generation with model: ${model}`);
            return result;
        } catch (error) {
            console.error(`❌ Error with Groq model ${model}:`, error.message);

            const result = {
                model: model,
                ideas: [`Groq demo error with ${model}: ${error.message}`],
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
                ideas: [`Unexpected Groq demo error: ${result.reason?.message || 'Unknown error'}`],
                success: false,
                error: true,
                errorMessage: result.reason?.message || 'Unknown error',
                timestamp: Date.now()
            };
        }
    });

    const successCount = finalResults.filter(r => r.success).length;
    const errorCount = finalResults.filter(r => !r.success).length;

    console.log(`🏁 Parallel Groq generation completed: ${successCount} successful, ${errorCount} failed`);

    return finalResults;
}