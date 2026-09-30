/**
 * Uzhavan AI Service — Provider Abstraction Layer
 * Level 1 Architecture Reference: Section 24, 25, 26
 *
 * Architecture rule: AI NEVER accesses MongoDB directly.
 * AI → intent extraction → typed tool call → application service → DB
 *
 * At Level 2 this file establishes the abstraction boundary.
 * Full NLU intent routing and tool execution lands in Level 4.
 */

import { env } from '../config/env.js';

/**
 * Provider status check
 */
export function isUzhavanReady() {
  return env.ai.isConfigured;
}

export function getProviderName() {
  return env.ai.provider;
}

/**
 * MOCK intent response for development / Level 2 verification.
 * Level 4 replaces this with real LLM function-calling.
 */
async function mockIntent(input) {
  return {
    intent: 'UZHAVAN_UNAVAILABLE',
    response: `Uzhavan AI is not yet configured. Set AI_API_KEY in server/.env to enable the assistant. You said: "${input}"`,
    confidence: 0,
    entities: {}
  };
}

/**
 * Process a user message through the Uzhavan AI pipeline.
 *
 * @param {object} params
 * @param {string} params.text - Transcribed or typed user input
 * @param {object} params.userContext - Authenticated user {id, role}
 * @param {string} params.language - 'en' | 'ta' | 'ta-en'
 * @param {Array}  params.conversationHistory - Prior turns (for context)
 * @returns {Promise<{intent, response, toolCalls, confidence}>}
 */
export async function processIntent({ text, userContext, language = 'en', conversationHistory = [] }) {
  if (!env.ai.isConfigured) {
    return mockIntent(text);
  }

  // Level 4 implementation will:
  //  1. Construct system prompt with user role & language context
  //  2. Send to LLM with function-calling tool schemas
  //  3. Parse tool call → dispatch to application service
  //  4. Return structured response for TTS
  throw new Error(`Uzhavan AI provider "${env.ai.provider}" is configured but not yet implemented. Pending Level 4.`);
}

/**
 * Registered Uzhavan AI Tools — schema definitions only.
 * Level 4 will attach these to LLM function-calling interface.
 * Level 1 Architecture Reference: Section 25 — AI Tool Registry
 */
export const UZHAVAN_TOOLS = Object.freeze([
  { name: 'create_product_listing',  module: 'catalog',         role: 'ROLE_FARMER' },
  { name: 'update_product_price',    module: 'catalog',         role: 'ROLE_FARMER' },
  { name: 'record_offline_sale',     module: 'inventory',       role: 'ROLE_FARMER' },
  { name: 'accept_buyer_request',    module: 'negotiation',     role: 'ROLE_FARMER' },
  { name: 'reject_buyer_request',    module: 'negotiation',     role: 'ROLE_FARMER' },
  { name: 'complete_order',          module: 'orders',          role: 'ROLE_FARMER' },
  { name: 'mark_order_no_show',      module: 'orders',          role: 'ROLE_FARMER' },
  { name: 'search_nearby_produce',   module: 'discovery',       role: 'public'      },
  { name: 'submit_buyer_request',    module: 'negotiation',     role: 'ROLE_BUYER'  },
  { name: 'confirm_order_quantity',  module: 'orders',          role: 'ROLE_BUYER'  },
  { name: 'query_demand_signals',    module: 'intelligence',    role: 'authenticated'},
  { name: 'sell_my_harvest_match',   module: 'intelligence',    role: 'ROLE_FARMER' },
  { name: 'list_harvest_byproduct',  module: 'byproducts',      role: 'ROLE_FARMER' }
]);
