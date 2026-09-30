/**
 * Uzhavan AI Service — Gemini LLM Integration Layer
 * Level 4 Architecture Reference: Section 6, 7, 8, 9, 10, 11
 *
 * Architecture chain (Level 1 rule, never violated):
 *   User → Uzhavan → Gemini → Intent + structured args → Tool → Auth → Business Service → MongoDB
 *
 * Gemini NEVER touches MongoDB directly.
 * Multi-turn conversation context managed via UzhavanConversation model.
 * Every AI action is audit-logged to UzhavanAuditLog model.
 */

import { GoogleGenAI } from '@google/genai';
import { callTool, getToolRegistry } from './uzhavan.tools.js';
import { buildGeminiFunctionDeclarations, buildUzhavanSystemInstruction } from './uzhavan.gemini.js';
import { UzhavanConversation } from './uzhavanConversation.model.js';
import { UzhavanAuditLog } from './uzhavanAuditLog.model.js';
import { extractProduceEntities } from '../../utils/cropIntelligence.js';
import { resolveTamilNaduLocation } from '../../utils/location.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { randomUUID } from 'crypto';

/**
 * Sensitive tools that ALWAYS require explicit confirmation before execution.
 */
const CONFIRMATION_REQUIRED_TOOLS = new Set([
  'deleteProduct',
  'completeOrder',
  'markNoShow',
  'recordOffPlatformSale',
  'cancelRequest'
]);

/**
 * Get or create a conversation session for the user.
 */
async function getOrCreateConversation(userId, conversationId) {
  if (conversationId) {
    const existing = await UzhavanConversation.findOne({ conversationId, userId });
    if (existing) return existing;
  }

  const newConversationId = conversationId || `conv-${userId}-${randomUUID().slice(0, 8)}`;
  return await UzhavanConversation.create({
    userId,
    conversationId: newConversationId,
    messages: [],
    contextData: { pendingIntent: null, draftArgs: {}, lastActiveTool: null },
    pendingConfirmation: { requiresConfirmation: false }
  });
}

/**
 * Write an audit log entry for every AI-initiated action.
 */
async function writeAuditLog({
  userId,
  conversationId,
  userCommand,
  language,
  detectedIntent,
  toolSelected,
  toolArguments,
  authorizationResult,
  executionResult,
  status,
  errorInfo
}) {
  try {
    await UzhavanAuditLog.create({
      userId,
      conversationId,
      userCommand,
      language,
      detectedIntent,
      toolSelected,
      toolArguments,
      authorizationResult,
      executionResult,
      status,
      errorInfo
    });
  } catch (err) {
    // Audit log failure never aborts the main action (fire-and-forget)
    console.error('[AUDIT LOG ERROR]', err.message);
  }
}

/**
 * Process a text or transcribed voice input using Gemini function-calling.
 * Returns structured response for the API controller.
 *
 * @param {{ text: string, userContext: object, language: string, conversationId: string }} input
 */
export async function processUserMessage({ text, userContext, language = 'en', conversationId }) {
  if (!text || text.trim().length === 0) {
    return {
      intent: 'EMPTY_INPUT',
      response: language === 'ta'
        ? 'நீங்கள் என்ன சொன்னீர்கள்? தயவுசெய்து மீண்டும் சொல்லுங்கள்.'
        : 'I didn\'t catch that. Please repeat what you\'d like to do.',
      requiresConfirmation: false
    };
  }

  // If AI not configured — return graceful degradation
  if (!env.ai.isConfigured) {
    return {
      intent: 'AI_UNAVAILABLE',
      response: language === 'ta'
        ? `உழவன் AI இன்னும் இயக்கப்படவில்லை. நீங்கள் சொன்னது: "${text}"`
        : `Uzhavan AI is not yet activated. You said: "${text}". Please use the app UI.`,
      requiresConfirmation: false,
      devNote: 'Set GEMINI_API_KEY in server/.env to enable Uzhavan AI.'
    };
  }

  let conversation;
  try {
    conversation = await getOrCreateConversation(userContext.id, conversationId);
  } catch (_dbErr) {
    // DB not available (e.g., test environment) — run without conversation persistence
    conversation = {
      conversationId: conversationId || `temp-${randomUUID().slice(0, 8)}`,
      messages: [],
      contextData: { pendingIntent: null, draftArgs: {}, lastActiveTool: null },
      pendingConfirmation: { requiresConfirmation: false },
      save: async () => {}
    };
  }

  // Check if there is a pending confirmation from a previous turn
  if (
    conversation.pendingConfirmation?.requiresConfirmation &&
    conversation.pendingConfirmation.expiresAt > new Date()
  ) {
    const lowerText = text.toLowerCase().trim();
    const isConfirmed = ['yes', 'confirm', 'ஆம்', 'சரி', 'ok', 'proceed', 'do it', 'haa'].some(
      (w) => lowerText.includes(w)
    );

    if (isConfirmed) {
      // Execute the pending confirmed tool
      const { toolName, params } = conversation.pendingConfirmation;
      conversation.pendingConfirmation = { requiresConfirmation: false };
      await conversation.save?.();

      try {
        const result = await callTool(toolName, userContext, params);

        await writeAuditLog({
          userId: userContext.id,
          conversationId: conversation.conversationId,
          userCommand: `CONFIRMED: ${toolName}`,
          language,
          detectedIntent: toolName,
          toolSelected: toolName,
          toolArguments: params,
          authorizationResult: { isAuthorized: true, userRole: userContext.role },
          executionResult: { success: true },
          status: 'SUCCESS'
        });

        return {
          conversationId: conversation.conversationId,
          intent: toolName,
          toolCalled: toolName,
          toolResult: result,
          response: language === 'ta'
            ? `✅ ${toolName} வெற்றிகரமாக நிறைவேற்றப்பட்டது.`
            : `✅ "${toolName}" completed successfully.`,
          requiresConfirmation: false
        };
      } catch (err) {
        await writeAuditLog({
          userId: userContext.id,
          conversationId: conversation.conversationId,
          userCommand: `CONFIRMED: ${toolName}`,
          language,
          detectedIntent: toolName,
          toolSelected: toolName,
          toolArguments: params,
          authorizationResult: { isAuthorized: true, userRole: userContext.role },
          executionResult: null,
          status: 'FAILED',
          errorInfo: err.message
        });
        throw err;
      }
    } else {
      // User cancelled the pending confirmation
      conversation.pendingConfirmation = { requiresConfirmation: false };
      await conversation.save?.();
      return {
        conversationId: conversation.conversationId,
        intent: 'CONFIRMATION_CANCELLED',
        response: language === 'ta'
          ? 'சரி, ரத்து செய்யப்பட்டது. வேறு என்ன உதவி வேண்டும்?'
          : 'Okay, cancelled. What else can I help you with?',
        requiresConfirmation: false
      };
    }
  }

  let toolName = null;
  let toolArgs = null;
  let assistantText = null;

  let activeLang = (language || 'en').toLowerCase().trim();
  const lowerText = text.toLowerCase();
  if (/\b(?:in|speak|tell\s+in)\s+marathi\b/i.test(lowerText) || text.includes('मराठी')) {
    activeLang = 'mr';
  } else if (/\b(?:in|speak|tell\s+in)\s+hindi\b/i.test(lowerText) || text.includes('हिंदी')) {
    activeLang = 'hi';
  } else if (/\b(?:in|speak|tell\s+in)\s+tamil\b/i.test(lowerText) || text.includes('தமிழ்')) {
    activeLang = 'ta';
  } else if (/\b(?:in|speak|tell\s+in)\s+english\b/i.test(lowerText)) {
    activeLang = 'en';
  } else if (/\b(?:in|speak|tell\s+in)\s+telugu\b/i.test(lowerText) || text.includes('తెలుగు')) {
    activeLang = 'te';
  } else if (/\b(?:in|speak|tell\s+in)\s+kannada\b/i.test(lowerText) || text.includes('ಕನ್ನಡ')) {
    activeLang = 'kn';
  } else if (/\b(?:in|speak|tell\s+in)\s+malayalam\b/i.test(lowerText) || text.includes('മലയാളം')) {
    activeLang = 'ml';
  } else if (/\b(?:in|speak|tell\s+in)\s+bengali\b/i.test(lowerText) || text.includes('বাংলা')) {
    activeLang = 'bn';
  } else if (/\b(?:in|speak|tell\s+in)\s+gujarati\b/i.test(lowerText) || text.includes('ગુજરાતી')) {
    activeLang = 'gu';
  } else if (/\b(?:in|speak)\s+tanglish\b/i.test(lowerText)) {
    activeLang = 'tanglish';
  }

  // Extract produce entities and locations early
  const extracted = extractProduceEntities(text);
  const loc = resolveTamilNaduLocation(text);
  if (loc) extracted.locationName = loc.city || loc.district;

  // Multi-turn backfill: recover missing price, quantity, crop, location, harvest date from recent conversation turns
  if (!extracted.pricePerUnit || !extracted.quantity || !extracted.name || !extracted.locationName || !extracted.harvestDate || !extracted.latitude) {
    const recentMsgs = (conversation.messages || []).slice(-8).reverse();
    for (const msg of recentMsgs) {
      const pastExtracted = extractProduceEntities(msg.content);
      const pastLoc = resolveTamilNaduLocation(msg.content);
      if (!extracted.pricePerUnit && pastExtracted.pricePerUnit) {
        extracted.pricePerUnit = pastExtracted.pricePerUnit;
      }
      if (!extracted.quantity && pastExtracted.quantity) {
        extracted.quantity = pastExtracted.quantity;
        if (!extracted.unit && pastExtracted.unit) extracted.unit = pastExtracted.unit;
      }
      if (!extracted.harvestDate && pastExtracted.harvestDate) {
        extracted.harvestDate = pastExtracted.harvestDate;
      }
      if (!extracted.name && pastExtracted.name) {
        extracted.name = pastExtracted.name;
        extracted.category = pastExtracted.category;
      }
      if (!extracted.locationName && (pastLoc || pastExtracted.locationName)) {
        extracted.locationName = pastLoc?.city || pastLoc?.district || pastExtracted.locationName;
      }
      if (!extracted.latitude && pastExtracted.latitude) {
        extracted.latitude = pastExtracted.latitude;
        extracted.longitude = pastExtracted.longitude;
      }
    }
  }

  // FAST PATH: Active draft resolution (e.g. farmer just answered missing crop name or quantity)
  if (conversation.contextData?.pendingIntent === 'createProduct') {
    const prevDraft = conversation.contextData?.draftArgs || {};
    // If draft was missing quantity, check if user provided a number (e.g. "in 5", "5", "5 kg", "100")
    if ((!prevDraft.quantity || isNaN(parseFloat(prevDraft.quantity))) && !extracted.quantity) {
      const bareNumMatch = text.match(/(?:in\s+|have\s+|about\s+)?(\d+(?:\.\d+)?)/i);
      if (bareNumMatch) {
        extracted.quantity = parseFloat(bareNumMatch[1]);
        if (!extracted.unit) extracted.unit = 'KG';
      }
    }
    // If draft was missing price, check if user provided a number
    if ((!prevDraft.pricePerUnit || isNaN(parseFloat(prevDraft.pricePerUnit))) && !extracted.pricePerUnit) {
      const barePriceMatch = text.match(/(?:rate\s+|price\s+|at\s+|in\s+)?(\d+(?:\.\d+)?)/i);
      if (barePriceMatch) {
        extracted.pricePerUnit = parseFloat(barePriceMatch[1]);
      }
    }

    const mergedDraft = { ...prevDraft, ...extracted };
    const q = parseFloat(mergedDraft.quantity ?? mergedDraft.totalStock ?? mergedDraft.stock);
    const p = parseFloat(mergedDraft.pricePerUnit ?? mergedDraft.price);
    const n = mergedDraft.name || mergedDraft.cropName || mergedDraft.produceName;

    if (n && !isNaN(q) && q > 0 && !isNaN(p) && p > 0) {
      toolName = 'createProduct';
      toolArgs = mergedDraft;
      conversation.contextData = { pendingIntent: null, draftArgs: {}, lastActiveTool: 'createProduct' };
    }
  }

  // FAST PATH 2: Complete produce intent in a single sentence (e.g. "Sell 50 kg Onion for 40 rs in Salem")
  if (!toolName && userContext.role === 'ROLE_FARMER') {
    const q = parseFloat(extracted.quantity ?? extracted.totalStock ?? extracted.stock);
    const p = parseFloat(extracted.pricePerUnit ?? extracted.price);
    const n = extracted.name || extracted.cropName || extracted.produceName;

    if (n && !isNaN(q) && q > 0 && !isNaN(p) && p > 0) {
      toolName = 'createProduct';
      toolArgs = {
        name: n,
        quantity: q,
        unit: extracted.unit || 'KG',
        pricePerUnit: p,
        locationName: extracted.locationName,
        harvestDate: extracted.harvestDate,
        latitude: extracted.latitude,
        longitude: extracted.longitude
      };
      conversation.contextData = { pendingIntent: null, draftArgs: {}, lastActiveTool: 'createProduct' };
    }
  }

  if (!toolName && (env.ai.provider === 'groq' || env.ai.apiKey?.startsWith('gsk_'))) {
    // ── Groq API with Qwen & Failover ──────────────────────────────────
    try {
      const systemInstruction = buildUzhavanSystemInstruction(userContext, conversation.contextData, activeLang);
      const geminiDecls = buildGeminiFunctionDeclarations();

      function fixType(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(fixType);
        const copy = { ...obj };
        if (typeof copy.type === 'string') copy.type = copy.type.toLowerCase();
        if (copy.properties) {
          const fixedProps = {};
          for (const [k, v] of Object.entries(copy.properties)) fixedProps[k] = fixType(v);
          copy.properties = fixedProps;
        }
        if (copy.items) copy.items = fixType(copy.items);
        return copy;
      }

      // Filter tools based on user role to keep payload lean and well under Groq TPM limits
      const role = userContext?.role;
      const filteredDecls = geminiDecls.filter((decl) => {
        const farmerTools = new Set([
          'createProduct', 'updateProduct', 'deleteProduct', 'getMyProducts',
          'addHarvest', 'recordOffPlatformSale', 'getFarmerRequests', 'acceptRequest', 'getMyOrders'
        ]);
        const buyerTools = new Set([
          'searchProducts', 'getProductDetails', 'submitRequest', 'confirmQuantity', 'getMyOrders'
        ]);

        if (role === 'ROLE_FARMER') return farmerTools.has(decl.name);
        if (role === 'ROLE_BUYER') return buyerTools.has(decl.name);
        return true;
      });

      const openAITools = filteredDecls.map((decl) => ({
        type: 'function',
        function: {
          name: decl.name,
          description: decl.description,
          parameters: fixType(decl.parameters || { type: 'object', properties: {} })
        }
      }));

      const messages = [
        { role: 'system', content: systemInstruction },
        ...(conversation.messages || []).slice(-4).map((msg) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        })),
        { role: 'user', content: text }
      ];

      // Multi-tier Groq execution with rate-limit retry and secondary model fallback
      const modelsToTry = [
        env.ai.model || 'qwen/qwen3.8-27b',
        'openai/gpt-oss-20b'
      ];

      let groqData = null;

      for (const mName of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.ai.apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: mName,
                messages,
                tools: openAITools,
                tool_choice: 'auto',
                temperature: 0.2
              })
            });

            if (resp.ok) {
              groqData = await resp.json();
              break;
            }

            if (resp.status === 429) {
              // Wait 1.3s for rate limit bucket reset
              await new Promise((resolve) => setTimeout(resolve, 1300));
              continue;
            } else {
              break;
            }
          } catch (_) {
            break;
          }
        }
        if (groqData) break;
      }

      if (!groqData) {
        // Fast command fallbacks if all models are unavailable
        const lowerCmd = text.toLowerCase().trim();
        if (/produce|products|பட்டியல்|विभागीय|माझे|दिखाएं|पिके/i.test(lowerCmd) && userContext.role === 'ROLE_FARMER') {
          toolName = 'getMyProducts';
          toolArgs = {};
        } else if (/request|கோரிக்கை|मागण्या|अनुरोध/i.test(lowerCmd) && userContext.role === 'ROLE_FARMER') {
          toolName = 'getFarmerRequests';
          toolArgs = {};
        } else if (/order|ஆர்டர்|ऑर्डर्स|आदेश/i.test(lowerCmd)) {
          toolName = 'getMyOrders';
          toolArgs = {};
        } else {
          const fallbacks = {
            en: "I'm ready to assist with your farm! Please tell me your crop name, quantity, and price (e.g. 50 kg Tomato at ₹20).",
            mr: "मी आपल्या शेती कामात मदत करण्यास तयार आहे! कृपया पिकाचे नाव, प्रमाण आणि दर सांगा (उदा. ५० किलो टोमॅटो ₹२०).",
            hi: "मैं आपकी खेती में सहायता के लिए तैयार हूँ! कृपया फसल का नाम, मात्रा और भाव बताएं (उदा. 50 किलो टमाटर ₹20).",
            ta: "உங்கள் பண்ணை வேலைகளில் உதவ நான் தயார்! விளைபொருள் பெயர், அளவு மற்றும் விலையைக் கூறுங்கள் (எ.கா: 50 கிலோ தக்காளி ₹20).",
            tanglish: "Farm help-ku naan ready! Crop name, quantity and price sollunga (e.g. 50 kg Tomato at 20 rs).",
            te: "మీ వ్యవసాయ సహాయానికి సిద్ధంగా ఉన్నాను! పంట పేరు, పరిమాణం మరియు ధర చెప్పండి.",
            kn: "ನಿಮ್ಮ ಕೃಷಿ ಸಹಾಯಕ್ಕೆ ನಾನು ಸಿದ್ಧ! ಬೆಳೆಯ ಹೆಸರು, ಪ್ರಮಾಣ ಮತ್ತು ಬೆಲೆ ತಿಳಿಸಿ.",
            ml: "നിങ്ങളുടെ കാർഷിക ആവശ്യങ്ങൾക്ക് സഹായിക്കാൻ ഞാൻ തയ്യാറാണ്! വിളയുടെ പേരും അളവും വിലയും പറയുക."
          };
          assistantText = fallbacks[activeLang] || fallbacks.en;
        }
      } else {
        const choice = groqData.choices?.[0]?.message;
        const toolCall = choice?.tool_calls?.[0];

        if (toolCall) {
          toolName = toolCall.function.name;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (_) {
            toolArgs = {};
          }
        } else {
          assistantText = choice?.content;
        }
      }
    } catch (groqErr) {
      console.error('[ROOT GROQ] API call handled:', groqErr.message);
      const fallbacks = {
        en: "I'm ready to help with your farm! Please tell me the crop name, quantity, and price.",
        mr: "मी आपल्या शेतीच्या नोंदी तपासून पाहत आहे. कृपया पिकाचे नाव व भाव सांगा.",
        hi: "मैं आपकी फसल दर्ज करने के लिए तैयार हूँ. कृपया फसल और मात्रा बताएं.",
        ta: "உங்கள் விளைபொருட்கள் பற்றி சொல்லுங்கள். நான் உடனடியாகப் பதிவு செய்கிறேன்."
      };
      assistantText = fallbacks[activeLang] || fallbacks.en;
    }
  } else if (!toolName) {
    // ── Gemini Function-Calling ─────────────────────────────────────────────
    const ai = new GoogleGenAI({ apiKey: env.ai.apiKey });

    // Build conversation history for multi-turn context
    const history = (conversation.messages || []).slice(-12).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const functionDeclarations = buildGeminiFunctionDeclarations();
    const systemInstruction = buildUzhavanSystemInstruction(userContext, conversation.contextData);

    let geminiResponse;
    try {
      const chat = ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
          systemInstruction,
          tools: [{ functionDeclarations }],
          temperature: 0.3
        },
        history
      });

      geminiResponse = await chat.sendMessage(text);
    } catch (geminiErr) {
      console.error('[UZHAVAN GEMINI] API call failed:', geminiErr.message);

      await writeAuditLog({
        userId: userContext.id,
        conversationId: conversation.conversationId,
        userCommand: text,
        language,
        detectedIntent: 'GEMINI_ERROR',
        toolSelected: null,
        toolArguments: {},
        authorizationResult: { isAuthorized: true, userRole: userContext.role },
        executionResult: null,
        status: 'FAILED',
        errorInfo: geminiErr.message
      });

      return {
        conversationId: conversation.conversationId,
        intent: 'GEMINI_ERROR',
        response: language === 'ta'
          ? 'ROOT AI இப்போது கிடைக்கவில்லை. தயவுசெய்து சிறிது நேரம் கழித்து முயற்சிக்கவும்.'
          : 'ROOT AI is temporarily unavailable. Please try again in a moment.',
        requiresConfirmation: false,
        error: geminiErr.message
      };
    }

    const candidate = geminiResponse.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const functionCallPart = parts.find((p) => p.functionCall);
    const textPart = parts.find((p) => p.text);

    if (functionCallPart) {
      toolName = functionCallPart.functionCall.name;
      toolArgs = functionCallPart.functionCall.args;
    } else {
      assistantText = textPart?.text;
    }
  }

  // Save user message to conversation
  conversation.messages.push({
    role: 'user',
    content: text,
    timestamp: new Date()
  });

  // Automatic multi-turn draft completion:
  // If no tool was called by LLM, but there is an active createProduct draft
  if (!toolName && conversation.contextData?.pendingIntent === 'createProduct') {
    const mergedDraft = { ...(conversation.contextData?.draftArgs || {}), ...extracted };
    const q = parseFloat(mergedDraft.quantity ?? mergedDraft.totalStock ?? mergedDraft.stock);
    const p = parseFloat(mergedDraft.pricePerUnit ?? mergedDraft.price);
    const n = mergedDraft.name || mergedDraft.cropName || mergedDraft.produceName;

    if (n && !isNaN(q) && q > 0 && !isNaN(p) && p > 0) {
      toolName = 'createProduct';
      toolArgs = mergedDraft;
      conversation.contextData = { pendingIntent: null, draftArgs: {}, lastActiveTool: 'createProduct' };
    }
  }

  // ── Hallucination Interceptor for Produce Listing ──────────────────────────
  // If the LLM replied with text claiming the product is live / created, or user intended to post,
  // ensure the product is ACTUALLY saved to MongoDB and returns toolCalled: 'createProduct'
  if (!toolName && assistantText && userContext.role === 'ROLE_FARMER') {
    const isClaimingListingDone = /listing is live|listing created|posted successfully|live on uzhavan|done.*listing|சந்தையில் நேரலையில் உள்ளது|வெற்றிகரமாக பதிவு/i.test(assistantText);
    const userWantsToPost = /post|list|sell|add|சேர்|பதிவு|விற்றல்|வெளியிடு/i.test(text);

    if (isClaimingListingDone || userWantsToPost) {
      const textEntities = extractProduceEntities(assistantText);
      const assistantLoc = resolveTamilNaduLocation(assistantText);

      const resolvedCrop = extracted.name || textEntities.name;
      const resolvedQty = parseFloat(extracted.quantity || textEntities.quantity);
      const resolvedPrice = parseFloat(extracted.pricePerUnit || textEntities.pricePerUnit);
      const resolvedLoc = extracted.locationName || assistantLoc?.city || assistantLoc?.district || textEntities.locationName;
      const resolvedHarvest = extracted.harvestDate || textEntities.harvestDate;

      if (resolvedCrop && !isNaN(resolvedQty) && resolvedQty > 0 && !isNaN(resolvedPrice) && resolvedPrice > 0) {
        console.log(`[ROOT RECOVERY] Executing intercepted createProduct for ${resolvedCrop} (${resolvedQty} kg @ ₹${resolvedPrice})`);
        toolName = 'createProduct';
        toolArgs = {
          name: resolvedCrop,
          quantity: resolvedQty,
          unit: extracted.unit || textEntities.unit || 'KG',
          pricePerUnit: resolvedPrice,
          locationName: resolvedLoc,
          harvestDate: resolvedHarvest,
          latitude: extracted.latitude || textEntities.latitude,
          longitude: extracted.longitude || textEntities.longitude
        };
        conversation.contextData = { pendingIntent: null, draftArgs: {}, lastActiveTool: 'createProduct' };
      }
    }
  }

  // If user provides produce details (e.g. price, harvest, location) without explicit crop or qty
  if (!toolName && (extracted.pricePerUnit || extracted.name) && userContext.role === 'ROLE_FARMER') {
    const q = parseFloat(extracted.quantity ?? extracted.totalStock);
    const n = extracted.name;
    const p = parseFloat(extracted.pricePerUnit);

    if (n && !isNaN(q) && q > 0 && !isNaN(p) && p > 0) {
      toolName = 'createProduct';
      toolArgs = extracted;
    } else {
      conversation.contextData = {
        pendingIntent: 'createProduct',
        draftArgs: extracted,
        lastActiveTool: 'createProduct'
      };
      await conversation.save?.();

      let clarif;
      const priceDisplay = !isNaN(p) && p > 0 ? `₹${p}/kg` : '';
      const locDisplay = extracted.locationName || '';
      const contextPieces = [priceDisplay, locDisplay, extracted.harvestDate ? 'அறுவடை/harvest: ' + extracted.harvestDate : ''].filter(Boolean).join(', ');

      if (!n && (isNaN(q) || q <= 0)) {
        clarif = language === 'ta'
          ? `விவரங்கள் குறித்துக்கொண்டேன் (${contextPieces || 'பதிவானது'}). விற்பனை செய்ய **எந்த விளைபொருள்** (எ.கா: தக்காளி, வெங்காயம்) மற்றும் **எவ்வளவு அளவு (கிலோ/மூட்டை)** உள்ளது என்று கூறுங்கள்.`
          : language === 'tanglish'
          ? `Noted details (${contextPieces || 'noted'}). **Enna crop** (e.g. Tomato, Onion) and **evlo quantity (kg/bags)** sell panna poreenga?`
          : `I have noted the details (${contextPieces || 'details noted'}). Which **crop** are you selling (e.g. Tomato, Onion, Paddy) and what **quantity (kg/bags)** do you have?`;
      } else if (!n) {
        clarif = language === 'ta'
          ? `விற்பனை செய்ய உள்ள **விளைபொருளின் பெயர்** (எ.கா: தக்காளி, வெங்காயம், நெல்) என்ன?`
          : `Which **crop** are you selling (e.g. Tomato, Onion, Paddy)?`;
      } else {
        clarif = language === 'ta'
          ? `**${n}** எத்தனை **கிலோ அல்லது மூட்டைகள் (அளவு)** விற்பனைக்கு உள்ளது?`
          : `How many **kg or bags** of **${n}** do you have available?`;
      }

      conversation.messages.push({ role: 'assistant', content: clarif, timestamp: new Date() });
      await conversation.save?.();

      return {
        conversationId: conversation.conversationId,
        intent: 'createProduct_DRAFT',
        toolCalled: null,
        response: clarif,
        requiresConfirmation: false
      };
    }
  }

  // ── AI chose to call a tool (or automated draft triggered tool) ─────
  if (toolName) {
    if (toolName === 'createProduct') {
      const prevDraft = conversation.contextData?.draftArgs || {};
      toolArgs = { ...prevDraft, ...extracted, ...toolArgs };

      const initialQty = parseFloat(toolArgs.quantity ?? toolArgs.totalStock ?? toolArgs.availableStock ?? toolArgs.stock ?? toolArgs.qty);
      const initialPrice = parseFloat(toolArgs.pricePerUnit ?? toolArgs.price ?? toolArgs.rate);
      const cropName = toolArgs.name || toolArgs.cropName || toolArgs.produceName;

      if (!cropName || isNaN(initialQty) || initialQty <= 0 || isNaN(initialPrice) || initialPrice <= 0) {
        conversation.contextData = {
          pendingIntent: 'createProduct',
          draftArgs: toolArgs,
          lastActiveTool: 'createProduct'
        };
        await conversation.save?.();

        let clarificationText;
        const priceDisplay = !isNaN(initialPrice) && initialPrice > 0 ? `₹${initialPrice}/kg` : '';
        const locDisplay = toolArgs.locationName || '';
        const contextPieces = [priceDisplay, locDisplay, toolArgs.harvestDate ? 'அறுவடை/harvest: ' + toolArgs.harvestDate : ''].filter(Boolean).join(', ');

        if (!cropName && (isNaN(initialQty) || initialQty <= 0)) {
          clarificationText = language === 'ta'
            ? `விவரங்கள் குறித்துக்கொண்டேன் (${contextPieces || 'பதிவானது'}). விற்பனை செய்ய **எந்த விளைபொருள்** (எ.கா: தக்காளி, வெங்காயம்) மற்றும் **எவ்வளவு அளவு (கிலோ/மூட்டை)** உள்ளது என்று கூறுங்கள்.`
            : language === 'tanglish'
            ? `Noted details (${contextPieces || 'noted'}). **Enna crop** (e.g. Tomato, Onion) and **evlo quantity (kg/bags)** sell panna poreenga?`
            : `I have noted the details (${contextPieces || 'details noted'}). Which **crop** are you selling (e.g. Tomato, Onion, Paddy) and what **quantity (kg/bags)** do you have?`;
        } else if (!cropName) {
          clarificationText = language === 'ta'
            ? `விற்பனை செய்ய உள்ள **விளைபொருளின் பெயர்** (எ.கா: தக்காளி, வெங்காயம், நெல்) என்ன?`
            : `Which **crop** are you selling (e.g. Tomato, Onion, Paddy)?`;
        } else if (isNaN(initialQty) || initialQty <= 0) {
          clarificationText = language === 'ta'
            ? `**${cropName}** எத்தனை **கிலோ அல்லது மூட்டைகள் (அளவு)** விற்பனைக்கு உள்ளது?`
            : `How many **kg or bags** of **${cropName}** do you have available?`;
        } else {
          clarificationText = language === 'ta'
            ? `**${cropName}** விலை என்ன (ரூபாய்/கிலோ)?`
            : `What is the price for **${cropName}** (in ₹/kg)?`;
        }

        conversation.messages.push({ role: 'assistant', content: clarificationText, timestamp: new Date() });
        await conversation.save?.();

        return {
          conversationId: conversation.conversationId,
          intent: 'createProduct_DRAFT',
          toolCalled: null,
          response: clarificationText,
          requiresConfirmation: false
        };
      }

      // Valid: clear draft
      conversation.contextData = { pendingIntent: null, draftArgs: {}, lastActiveTool: 'createProduct' };
    }

    // DESTRUCTIVE TOOLS: require confirmation
    if (CONFIRMATION_REQUIRED_TOOLS.has(toolName)) {
      const confirmationPrompt = buildConfirmationPrompt(toolName, toolArgs, language);

      // Store pending confirmation in conversation
      conversation.pendingConfirmation = {
        requiresConfirmation: true,
        toolName,
        params: toolArgs,
        confirmationPrompt,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5-minute window
      };

      conversation.messages.push({
        role: 'assistant',
        content: confirmationPrompt,
        timestamp: new Date()
      });
      await conversation.save?.();

      await writeAuditLog({
        userId: userContext.id,
        conversationId: conversation.conversationId,
        userCommand: text,
        language,
        detectedIntent: toolName,
        toolSelected: toolName,
        toolArguments: toolArgs,
        authorizationResult: { isAuthorized: true, userRole: userContext.role },
        executionResult: null,
        status: 'CONFIRMATION_PENDING'
      });

      return {
        conversationId: conversation.conversationId,
        intent: toolName,
        toolCalled: null,
        response: confirmationPrompt,
        requiresConfirmation: true,
        toolName,
        params: toolArgs
      };
    }

    // NON-DESTRUCTIVE TOOLS: execute immediately
    let toolResult;
    let auditStatus = 'SUCCESS';
    let errorInfo = null;

    try {
      toolResult = await callTool(toolName, userContext, toolArgs);
    } catch (toolErr) {
      auditStatus = toolErr.statusCode === 403 ? 'UNAUTHORIZED' : 'FAILED';
      errorInfo = toolErr.message;

      await writeAuditLog({
        userId: userContext.id,
        conversationId: conversation.conversationId,
        userCommand: text,
        language: activeLang,
        detectedIntent: toolName,
        toolSelected: toolName,
        toolArguments: toolArgs,
        authorizationResult: { isAuthorized: toolErr.statusCode !== 403, userRole: userContext.role },
        executionResult: null,
        status: auditStatus,
        errorInfo
      });

      // Generate friendly error response
      const errResponse = activeLang === 'ta'
        ? `மன்னிக்கவும், "${toolName}" செயல்படுத்த முடியவில்லை: ${toolErr.message}`
        : activeLang === 'mr'
        ? `माफ करा, "${toolName}" पूर्ण करता आले नाही: ${toolErr.message}`
        : activeLang === 'hi'
        ? `क्षमा करें, "${toolName}" निष्पादित नहीं किया जा सका: ${toolErr.message}`
        : `Sorry, couldn't execute "${toolName}": ${toolErr.message}`;

      conversation.messages.push({ role: 'assistant', content: errResponse, timestamp: new Date() });
      await conversation.save?.();

      return {
        conversationId: conversation.conversationId,
        intent: toolName,
        toolCalled: toolName,
        response: errResponse,
        requiresConfirmation: false,
        error: toolErr.message
      };
    }

    // Build assistant response text
    const successMsg = buildToolSuccessMessage(toolName, toolResult, activeLang);

    conversation.messages.push({
      role: 'assistant',
      content: successMsg,
      toolCalls: [{ name: toolName, args: toolArgs }],
      toolResult,
      timestamp: new Date()
    });
    conversation.contextData.lastActiveTool = toolName;
    await conversation.save?.();

    await writeAuditLog({
      userId: userContext.id,
      conversationId: conversation.conversationId,
      userCommand: text,
      language: activeLang,
      detectedIntent: toolName,
      toolSelected: toolName,
      toolArguments: toolArgs,
      authorizationResult: { isAuthorized: true, userRole: userContext.role },
      executionResult: { success: true, resultSummary: typeof toolResult === 'object' ? 'OK' : toolResult },
      status: auditStatus
    });

    return {
      conversationId: conversation.conversationId,
      intent: toolName,
      toolCalled: toolName,
      toolResult,
      response: successMsg,
      requiresConfirmation: false
    };
  }

  // ── AI returned a plain text response (clarification or conversation) ──
  const finalText = assistantText || (activeLang === 'ta'
    ? 'மன்னிக்கவும், நான் புரிந்துகொள்ளவில்லை. மீண்டும் கூறுங்கள்.'
    : activeLang === 'mr'
    ? 'माफ करा, मला समजले नाही. कृपया पुन्हा सांगा.'
    : activeLang === 'hi'
    ? 'क्षमा करें, मैं समझ नहीं पाया. कृपया दोबारा बताएं.'
    : 'Sorry, I didn\'t catch that. Please rephrase.');

  conversation.messages.push({
    role: 'assistant',
    content: finalText,
    timestamp: new Date()
  });
  await conversation.save?.();

  await writeAuditLog({
    userId: userContext.id,
    conversationId: conversation.conversationId,
    userCommand: text,
    language: activeLang,
    detectedIntent: 'CLARIFICATION',
    toolSelected: null,
    toolArguments: {},
    authorizationResult: { isAuthorized: true, userRole: userContext.role },
    executionResult: { response: finalText },
    status: 'SUCCESS'
  });

  return {
    conversationId: conversation.conversationId,
    intent: 'CLARIFICATION',
    toolCalled: null,
    response: finalText,
    requiresConfirmation: false
  };
}

/**
 * Direct tool dispatch — used when the frontend knows the specific tool and args.
 */
export async function dispatchTool({ toolName, userContext, params, confirmationGiven = false }) {
  if (CONFIRMATION_REQUIRED_TOOLS.has(toolName) && !confirmationGiven) {
    return {
      requiresConfirmation: true,
      toolName,
      params,
      confirmationPrompt: buildConfirmationPrompt(toolName, params, 'en')
    };
  }

  const result = await callTool(toolName, userContext, params);

  await writeAuditLog({
    userId: userContext.id,
    conversationId: 'direct-dispatch',
    userCommand: `DIRECT_DISPATCH:${toolName}`,
    language: 'en',
    detectedIntent: toolName,
    toolSelected: toolName,
    toolArguments: params,
    authorizationResult: { isAuthorized: true, userRole: userContext.role },
    executionResult: { success: true },
    status: 'SUCCESS'
  });

  return { requiresConfirmation: false, toolName, result };
}

/**
 * Build a human-readable confirmation prompt for destructive actions.
 */
function buildConfirmationPrompt(toolName, params, language = 'en') {
  if (language === 'ta') {
    const prompts = {
      deleteProduct: 'இந்த விளைபொருள் பட்டியலை நிரந்தரமாக நீக்க விரும்புகிறீர்களா? (ஆம் / இல்லை)',
      completeOrder: `ஆர்டரை முழுமையாக நிறைவு செய்ய விரும்புகிறீர்களா? (ஆம் / இல்லை)`,
      markNoShow: 'வாங்குபவர் வரவில்லை என்று குறிக்க விரும்புகிறீர்களா? ஒதுக்கப்பட்ட இருப்பு திரும்ப வரும். (ஆம் / இல்லை)',
      recordOffPlatformSale: `வெளிச் சந்தை விற்பனையை பதிவு செய்ய விரும்புகிறீர்களா? (ஆம் / இல்லை)`,
      cancelRequest: 'இந்த கோரிக்கையை ரத்து செய்ய விரும்புகிறீர்களா? (ஆம் / இல்லை)'
    };
    return prompts[toolName] || `உறுதிப்படுத்தவும்: "${toolName}" செயல்படுத்தவா? (ஆம் / இல்லை)`;
  }
  if (language === 'mr') {
    const prompts = {
      deleteProduct: 'आपण ही शेतमाल यादी कायमस्वरूपी काढू इच्छिता? (होय / नाही)',
      completeOrder: 'ही ऑर्डर पूर्ण झाली म्हणून नोंदवायची आहे का? (होय / नाही)',
      markNoShow: 'खरेदीदार आला नाही अशी नोंद करायची आहे का? (होय / नाही)',
      recordOffPlatformSale: 'बाहेरील विक्री नोंदवायची आहे का? (होय / नाही)',
      cancelRequest: 'हा खरेदी विनंती अर्ज रद्द करायचा आहे का? (होय / नाही)'
    };
    return prompts[toolName] || `पुष्टी करा: "${toolName}" करायचे आहे का? (होय / नाही)`;
  }
  if (language === 'hi') {
    const prompts = {
      deleteProduct: 'क्या आप इस फसल सूची को हमेशा के लिए हटाना चाहते हैं? (हाँ / नहीं)',
      completeOrder: 'क्या आप इस ऑर्डर को पूर्ण चिह्नित करना चाहते हैं? (हाँ / नहीं)',
      markNoShow: 'क्या आप खरीदार को अनुपस्थित चिह्नित करना चाहते हैं? (हाँ / नहीं)',
      recordOffPlatformSale: 'क्या आप बाहरी नकद बिक्री दर्ज करना चाहते हैं? (हाँ / नहीं)',
      cancelRequest: 'क्या आप इस अनुरोध को रद्द करना चाहते हैं? (हाँ / नहीं)'
    };
    return prompts[toolName] || `पुष्टि करें: "${toolName}" निष्पादित करें? (हाँ / नहीं)`;
  }

  const prompts = {
    deleteProduct: 'Are you sure you want to permanently remove this produce listing? (Yes / No)',
    completeOrder: params?.fulfilledQuantity
      ? `Confirm: Mark this order as completed with ${params.fulfilledQuantity} delivered? (Yes / No)`
      : 'Confirm: Mark this order as fully completed? (Yes / No)',
    markNoShow: 'Confirm: Mark buyer as No-Show? Reserved stock will return to available inventory. (Yes / No)',
    recordOffPlatformSale: `Confirm: Record an external sale of ${params?.quantity || '?'} units from your stock? (Yes / No)`,
    cancelRequest: 'Confirm: Cancel this purchase request? (Yes / No)'
  };
  return prompts[toolName] || `Confirm: Execute "${toolName}"? (Yes / No)`;
}

/**
 * Build a friendly success message after tool execution.
 */
function buildToolSuccessMessage(toolName, result, language = 'en') {
  if (toolName === 'createProduct' && result) {
    const locName = result.address?.city || result.address?.district || 'Farm';
    if (language === 'ta') {
      return `✅ **${result.name}** பட்டியல் வெற்றிகரமாக சேர்க்கப்பட்டது!\n• அளவு: **${result.totalStock} ${result.unit}**\n• விலை: **₹${result.pricePerUnit} / ${result.unit}**\n• இடம்: **${locName}**\nஉங்கள் விளைபொருள் இப்போது வாங்குபவர்களின் வரைபடத்தில் நேரலையாக உள்ளது!`;
    } else if (language === 'tanglish') {
      return `✅ **${result.name}** listing successfully create aagiduchu!\n• Quantity: **${result.totalStock} ${result.unit}**\n• Price: **₹${result.pricePerUnit} / ${result.unit}**\n• Location: **${locName}**\nBuyers map-la live-ah irukku!`;
    } else if (language === 'mr') {
      return `✅ **${result.name}** यशस्वीरीत्या जोडले गेले!\n• प्रमाण: **${result.totalStock} ${result.unit}**\n• भाव: **₹${result.pricePerUnit} / ${result.unit}**\n• ठिकाण: **${locName}**\nतुमचा शेतमाल आता बाजारात खरेदीदारांसाठी थेट उपलब्ध आहे!`;
    } else if (language === 'hi') {
      return `✅ **${result.name}** सफलतापूर्वक सूचीबद्ध हो गया!\n• मात्रा: **${result.totalStock} ${result.unit}**\n• मूल्य: **₹${result.pricePerUnit} / ${result.unit}**\n• स्थान: **${locName}**\nआपकी फसल अब खरीदारों के लिए बाज़ार में लाइव है!`;
    } else if (language === 'te') {
      return `✅ **${result.name}** విజయవంతంగా జాబితా చేయబడింది!\n• పరిమాణం: **${result.totalStock} ${result.unit}**\n• ధర: **₹${result.pricePerUnit} / ${result.unit}**\n• స్థలం: **${locName}**`;
    } else if (language === 'kn') {
      return `✅ **${result.name}** ಯಶಸ್ವಿಯಾಗಿ ಪಟ್ಟಿಮಾಡಲಾಗಿದೆ!\n• ಪ್ರಮಾಣ: **${result.totalStock} ${result.unit}**\n• ಬೆಲೆ: **₹${result.pricePerUnit} / ${result.unit}**\n• ಸ್ಥಳ: **${locName}**`;
    } else if (language === 'ml') {
      return `✅ **${result.name}** വിജയകരമായി ലിസ്റ്റ് ചെയ്തു!\n• അളവ്: **${result.totalStock} ${result.unit}**\n• വില: **₹${result.pricePerUnit} / ${result.unit}**\n• സ്ഥലം: **${locName}**`;
    }
    return `✅ **${result.name}** listing created successfully!\n• Quantity: **${result.totalStock} ${result.unit}**\n• Price: **₹${result.pricePerUnit} / ${result.unit}**\n• Location: **${locName}**\nYour produce is now live on the marketplace map for buyers!`;
  }

  if (toolName === 'getMyProducts') {
    const prods = Array.isArray(result) ? result : [];
    if (prods.length === 0) {
      if (language === 'ta') return 'உங்களிடம் இன்னும் எந்த விளைபொருளும் பட்டியலிடப்படவில்லை. விளைபொருளைச் சேர்க்க "100 கிலோ தக்காளி ₹25" என்று கூறவும்.';
      if (language === 'mr') return 'तुमच्याकडे अजून कोणतीही सक्रिय शेतमाल यादी नाही. "१०० किलो टोमॅटो २५ रुपये" असे सांगा.';
      if (language === 'hi') return 'आपके पास अभी कोई सक्रिय फसल सूची नहीं है। "100 किलो टमाटर 25 रु" कहकर नई सूची बनाएं।';
      return 'You have no active produce listings yet. Say something like "Add 100 kg tomato for 25 rs" to create one.';
    }
    const lines = prods.slice(0, 5).map((p) => `• **${p.name}**: ${p.availableStock} ${p.unit} · ₹${p.pricePerUnit}/${p.unit}`);
    if (language === 'ta') return `✅ உங்களிடம் **${prods.length}** விளைபொருட்கள் உள்ளன:\n${lines.join('\n')}`;
    if (language === 'mr') return `✅ आपल्याकडे **${prods.length}** शेतमाल नोंदी आहेत:\n${lines.join('\n')}`;
    if (language === 'hi') return `✅ आपके पास **${prods.length}** सक्रिय फसलें हैं:\n${lines.join('\n')}`;
    return `✅ You have **${prods.length}** active produce batch${prods.length > 1 ? 'es' : ''}:\n${lines.join('\n')}`;
  }

  if (toolName === 'getFarmerRequests') {
    const reqs = Array.isArray(result?.requests) ? result.requests : Array.isArray(result) ? result : [];
    if (reqs.length === 0) {
      if (language === 'ta') return 'தற்போது புதிய வாங்குபவர் கோரிக்கைகள் எதுவும் இல்லை.';
      if (language === 'mr') return 'सध्या कोणतीही नवीन खरेदीदार विनंती नाही.';
      if (language === 'hi') return 'इस समय खरीदार का कोई नया अनुरोध नहीं है।';
      return 'No pending buyer requests at the moment.';
    }
    const lines = reqs.slice(0, 5).map((r) => `• **${r.productId?.name || 'Produce'}** (${r.status}): ${r.buyerId?.name || 'Buyer'}`);
    if (language === 'ta') return `✅ உங்களிடம் **${reqs.length}** வாங்குபவர் கோரிக்கைகள் உள்ளன:\n${lines.join('\n')}`;
    if (language === 'mr') return `✅ आपल्याकडे **${reqs.length}** खरेदीदार विनंत्या आहेत:\n${lines.join('\n')}`;
    if (language === 'hi') return `✅ आपके पास **${reqs.length}** खरीदार अनुरोध हैं:\n${lines.join('\n')}`;
    return `✅ You have **${reqs.length}** buyer request${reqs.length > 1 ? 's' : ''}:\n${lines.join('\n')}`;
  }

  if (toolName === 'getMyOrders') {
    const orders = Array.isArray(result?.orders) ? result.orders : Array.isArray(result) ? result : [];
    if (orders.length === 0) {
      if (language === 'ta') return 'ஆர்டர்கள் எதுவும் இல்லை.';
      if (language === 'mr') return 'कोणत्याही ऑर्डर्स नाहीत.';
      if (language === 'hi') return 'कोई ऑर्डर नहीं मिला।';
      return 'No orders found.';
    }
    const lines = orders.slice(0, 5).map((o) => `• Order #${(o._id || o.id).toString().slice(-6)}: **${o.productId?.name || 'Produce'}** (${o.status}) · ₹${o.totalAmount || 0}`);
    if (language === 'ta') return `✅ உங்களிடம் **${orders.length}** ஆர்டர்கள் உள்ளன:\n${lines.join('\n')}`;
    if (language === 'mr') return `✅ आपल्याकडे **${orders.length}** ऑर्डर्स आहेत:\n${lines.join('\n')}`;
    if (language === 'hi') return `✅ आपके पास **${orders.length}** ऑर्डर्स हैं:\n${lines.join('\n')}`;
    return `✅ You have **${orders.length}** order${orders.length > 1 ? 's' : ''}:\n${lines.join('\n')}`;
  }

  if (language === 'ta') {
    const tamilMessages = {
      updateProduct: '✅ விளைபொருள் விவரம் புதுப்பிக்கப்பட்டது.',
      deleteProduct: '✅ விளைபொருள் பட்டியல் நீக்கப்பட்டது.',
      addHarvest: '✅ அறுவடை இருப்பு வெற்றிகரமாக சேர்க்கப்பட்டது.',
      recordOffPlatformSale: '✅ வெளிச் சந்தை விற்பனை பதிவேட்டில் குறிக்கப்பட்டது.',
      submitRequest: '✅ கோரிக்கை அனுப்பப்பட்டது. உழவர் பதில் அனுப்பும்வரை காத்திருக்கவும்.',
      acceptRequest: '✅ கோரிக்கை ஏற்றுக்கொள்ளப்பட்டது.',
      rejectRequest: '✅ கோரிக்கை நிராகரிக்கப்பட்டது.',
      completeOrder: '✅ ஆர்டர் நிறைவு செய்யப்பட்டது.',
      searchProducts: `✅ ${Array.isArray(result?.items) ? result.items.length : 0} விளைபொருட்கள் கிடைத்தன.`,
      listByproduct: '✅ பக்கவிளைபொருள் சந்தையில் பட்டியலிடப்பட்டது.'
    };
    return tamilMessages[toolName] || '✅ செயல் வெற்றிகரமாக நிறைவேற்றப்பட்டது.';
  }

  if (language === 'mr') {
    const marathiMessages = {
      updateProduct: '✅ शेतमाल माहिती अपडेट केली.',
      deleteProduct: '✅ शेतमाल यादीतून काढले.',
      addHarvest: '✅ नवीन हंगाम साठा यशस्वीरीत्या जोडला.',
      recordOffPlatformSale: '✅ बाहेरील रोख विक्री नोंदवली गेली.',
      submitRequest: '✅ खरेदी विनंती पाठवली गेली.',
      acceptRequest: '✅ विनंती स्वीकारली गेली.',
      rejectRequest: '✅ विनंती नाकारली गेली.',
      completeOrder: '✅ ऑर्डर पूर्ण झाली.',
      searchProducts: `✅ ${Array.isArray(result?.items) ? result.items.length : 0} शेतमाल आढळले.`,
      listByproduct: '✅ उपउत्पादन बाजारात जोडले गेले.'
    };
    return marathiMessages[toolName] || '✅ कार्य यशस्वीरीत्या पूर्ण झाले.';
  }

  if (language === 'hi') {
    const hindiMessages = {
      updateProduct: '✅ फसल विवरण अपडेट किया गया।',
      deleteProduct: '✅ फसल सूची से हटा दी गई।',
      addHarvest: '✅ नया स्टॉक इन्वेंट्री में जोड़ा गया।',
      recordOffPlatformSale: '✅ बाहरी नकद बिक्री बहीखाते में दर्ज की गई।',
      submitRequest: '✅ खरीद अनुरोध किसान को भेजा गया।',
      acceptRequest: '✅ अनुरोध स्वीकार कर लिया गया।',
      rejectRequest: '✅ अनुरोध अस्वीकार कर दिया गया।',
      completeOrder: '✅ ऑर्डर पूरा हुआ।',
      searchProducts: `✅ आपके आस-पास ${Array.isArray(result?.items) ? result.items.length : 0} फसलें मिलीं।`,
      listByproduct: '✅ सह-उत्पाद बाज़ार में सूचीबद्ध हुआ।'
    };
    return hindiMessages[toolName] || '✅ कार्य सफलतापूर्वक पूर्ण हुआ।';
  }

  const englishMessages = {
    updateProduct: '✅ Product updated.',
    deleteProduct: '✅ Produce listing removed.',
    addHarvest: '✅ Harvest stock added to your inventory.',
    recordOffPlatformSale: '✅ Off-platform cash sale recorded in ledger.',
    submitRequest: '✅ Purchase request sent to the farmer.',
    acceptRequest: '✅ Request accepted. The buyer will confirm quantity.',
    rejectRequest: '✅ Request rejected.',
    completeOrder: '✅ Order marked completed.',
    getDemandSignals: '✅ Here are the market demand signals:',
    sellMyHarvestMatch: '✅ Here are your best demand-matching opportunities:',
    searchProducts: `✅ Found ${Array.isArray(result?.items) ? result.items.length : 0} produce listings near you.`,
    listByproduct: '✅ Byproduct listed on marketplace.'
  };

  return englishMessages[toolName] || `✅ "${toolName}" completed successfully.`;
}

export { getToolRegistry };
