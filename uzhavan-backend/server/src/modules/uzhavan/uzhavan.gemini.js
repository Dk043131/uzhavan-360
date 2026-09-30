/**
 * Uzhavan 360 — Gemini Function-Calling Schema Generator
 * Level 4 Architecture Reference: Section 6, 7, 8
 *
 * Converts the 23-tool Uzhavan registry into Gemini-compatible FunctionDeclaration
 * schemas so the LLM can select and invoke tools via structured function-calling.
 *
 * CRITICAL: Gemini NEVER accesses MongoDB directly.
 * Gemini extracts intent + args → our tool gateway enforces auth → same business services.
 */

// Map Uzhavan tool names to their Gemini FunctionDeclaration schemas
export function buildGeminiFunctionDeclarations() {
  return [
    // ── Discovery & Search ────────────────────────────────────────────────────
    {
      name: 'searchProducts',
      description: 'Search nearby produce listings on the marketplace. Use when the user wants to find crops, vegetables, or farm produce near them.',
      parameters: {
        type: 'OBJECT',
        properties: {
          lat: { type: 'NUMBER', description: 'Latitude of buyer location' },
          lng: { type: 'NUMBER', description: 'Longitude of buyer location' },
          radius: { type: 'NUMBER', description: 'Search radius in kilometers. Default 25.' },
          category: { type: 'STRING', description: 'Crop category filter: LEAFY, FRUITING, TUBER, ROOT, GRAIN, CITRUS, OTHER' }
        }
      }
    },
    {
      name: 'getProductDetails',
      description: 'Get full details of a specific produce listing by its ID.',
      parameters: {
        type: 'OBJECT',
        required: ['productId'],
        properties: {
          productId: { type: 'STRING', description: 'MongoDB ID of the product listing' }
        }
      }
    },
    {
      name: 'getDemandSignals',
      description: 'Show market demand trends for a crop category or commodity in a district.',
      parameters: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', description: 'Crop category: LEAFY, FRUITING, TUBER, ROOT, GRAIN, CITRUS, OTHER' },
          district: { type: 'STRING', description: 'District name, default is Coimbatore' }
        }
      }
    },
    {
      name: 'searchByproducts',
      description: 'Search for available harvest byproducts (straw, bagasse, shells, stalks) from nearby farmers.',
      parameters: {
        type: 'OBJECT',
        properties: {
          lat: { type: 'NUMBER', description: 'Latitude' },
          lng: { type: 'NUMBER', description: 'Longitude' },
          category: { type: 'STRING', description: 'Byproduct category' }
        }
      }
    },

    // ── Farmer: Catalog ───────────────────────────────────────────────────────
    {
      name: 'createProduct',
      description: 'Create a new produce listing on the marketplace. FARMER ONLY. Directly automate listing crops (tomatoes, onions, paddy, etc.) to sell.',
      parameters: {
        type: 'OBJECT',
        required: ['name', 'pricePerUnit', 'quantity'],
        properties: {
          name: { type: 'STRING', description: 'Name of the crop/produce in Tamil or English (e.g., Tomato / தக்காளி, Onion / வெங்காயம், Paddy / நெல், Brinjal / கத்தரிக்காய்).' },
          quantity: { type: 'NUMBER', description: 'Total quantity available to sell (e.g. 100, 50, 500).' },
          pricePerUnit: { type: 'NUMBER', description: 'Price per unit in INR (₹) (e.g. 5, 25, 40).' },
          unit: { type: 'STRING', description: 'Unit: KG | GRAM | TON | LITRE | BUNCH | PIECE | BAG | BOX | CRATE. Default KG.' },
          category: { type: 'STRING', description: 'LEAFY | FLOWER | FRUITING | TUBER | ROOT | GRAIN | CITRUS | OTHER. Auto-detected if omitted.' },
          locationName: { type: 'STRING', description: 'City/town/district name (e.g. Salem, Madurai, Coimbatore, Chennai, Erode). Coordinates are resolved automatically! Never ask the farmer for GPS coordinates.' },
          harvestDate: { type: 'STRING', description: 'Harvest date in ISO format (YYYY-MM-DD) or "today"/"tomorrow". Default today.' },
          description: { type: 'STRING', description: 'Optional description of the produce' }
        }
      }
    },
    {
      name: 'updateProduct',
      description: 'Update an existing produce listing. FARMER ONLY. For price updates, description changes.',
      parameters: {
        type: 'OBJECT',
        properties: {
          productId: { type: 'STRING', description: 'Product ID to update if known' },
          produceName: { type: 'STRING', description: 'Crop name if productId not known (e.g. Tomato / தக்காளி)' },
          pricePerUnit: { type: 'NUMBER', description: 'New price per unit in INR (₹)' },
          description: { type: 'STRING', description: 'Updated description' }
        }
      }
    },
    {
      name: 'deleteProduct',
      description: 'Delete a produce listing. FARMER ONLY. DESTRUCTIVE — requires confirmation.',
      parameters: {
        type: 'OBJECT',
        properties: {
          productId: { type: 'STRING', description: 'Product ID to delete if known' },
          produceName: { type: 'STRING', description: 'Crop name to delete (e.g. Tomato)' }
        }
      }
    },
    {
      name: 'getMyProducts',
      description: 'List all produce batches posted by the logged-in farmer.',
      parameters: { type: 'OBJECT', properties: {} }
    },

    // ── Farmer: Inventory ─────────────────────────────────────────────────────
    {
      name: 'addHarvest',
      description: 'Add additional harvest stock to an existing product batch. FARMER ONLY.',
      parameters: {
        type: 'OBJECT',
        required: ['quantity'],
        properties: {
          productId: { type: 'STRING', description: 'Product ID to replenish if known' },
          produceName: { type: 'STRING', description: 'Crop name to replenish (e.g. Tomato / தக்காளி)' },
          quantity: { type: 'NUMBER', description: 'Amount to add (in listed unit)' },
          reason: { type: 'STRING', description: 'Optional reason for addition' }
        }
      }
    },
    {
      name: 'recordOffPlatformSale',
      description: 'Record a direct farmgate or village market cash sale that happened outside Uzhavan 360. FARMER ONLY. DESTRUCTIVE — requires confirmation.',
      parameters: {
        type: 'OBJECT',
        required: ['quantity'],
        properties: {
          productId: { type: 'STRING', description: 'Product ID sold externally if known' },
          produceName: { type: 'STRING', description: 'Crop name sold (e.g. Tomato)' },
          quantity: { type: 'NUMBER', description: 'Amount sold outside platform' },
          reason: { type: 'STRING', description: 'Notes e.g. "sold at Coimbatore sandhai"' }
        }
      }
    },
    {
      name: 'getInventoryHistory',
      description: 'View the complete double-entry inventory audit ledger for a product. FARMER ONLY.',
      parameters: {
        type: 'OBJECT',
        required: ['productId'],
        properties: {
          productId: { type: 'STRING', description: 'Product ID whose ledger to view' }
        }
      }
    },

    // ── Buyer: Requests ───────────────────────────────────────────────────────
    {
      name: 'submitRequest',
      description: 'Send a purchase interest request to a farmer. BUYER ONLY. Called when buyer wants to buy or inquire about a product.',
      parameters: {
        type: 'OBJECT',
        required: ['productId'],
        properties: {
          productId: { type: 'STRING', description: 'ID of the product the buyer is interested in' },
          note: { type: 'STRING', description: 'Optional message to the farmer' }
        }
      }
    },
    {
      name: 'cancelRequest',
      description: 'Cancel a pending purchase request. BUYER ONLY. DESTRUCTIVE — requires confirmation.',
      parameters: {
        type: 'OBJECT',
        required: ['requestId'],
        properties: {
          requestId: { type: 'STRING', description: 'Request ID to cancel' },
          reason: { type: 'STRING', description: 'Reason for cancellation' }
        }
      }
    },

    // ── Farmer: Requests ──────────────────────────────────────────────────────
    {
      name: 'getFarmerRequests',
      description: 'View all incoming buyer requests for the farmer\'s produce. FARMER ONLY.',
      parameters: {
        type: 'OBJECT',
        properties: {
          status: { type: 'STRING', description: 'Filter by status: REQUESTED | ACCEPTED | REJECTED | CANCELLED' }
        }
      }
    },
    {
      name: 'acceptRequest',
      description: 'Accept a buyer\'s produce purchase request. FARMER ONLY.',
      parameters: {
        type: 'OBJECT',
        required: ['requestId'],
        properties: {
          requestId: { type: 'STRING', description: 'Request ID to accept' }
        }
      }
    },
    {
      name: 'rejectRequest',
      description: 'Reject a buyer request with a reason. FARMER ONLY.',
      parameters: {
        type: 'OBJECT',
        required: ['requestId'],
        properties: {
          requestId: { type: 'STRING', description: 'Request ID to reject' },
          reason: { type: 'STRING', description: 'Reason for rejection' }
        }
      }
    },

    // ── Orders ────────────────────────────────────────────────────────────────
    {
      name: 'confirmQuantity',
      description: 'Confirm the exact quantity to buy and atomically reserve stock. BUYER ONLY.',
      parameters: {
        type: 'OBJECT',
        required: ['requestId', 'quantity'],
        properties: {
          requestId: { type: 'STRING', description: 'Accepted request ID to confirm' },
          quantity: { type: 'NUMBER', description: 'Quantity to reserve' },
          idempotencyKey: { type: 'STRING', description: 'Optional unique key to prevent duplicate reservations' }
        }
      }
    },
    {
      name: 'getMyOrders',
      description: 'List orders for the current user (farmer sees their sales, buyer sees their purchases).',
      parameters: {
        type: 'OBJECT',
        properties: {
          status: { type: 'STRING', description: 'Filter by order status' }
        }
      }
    },
    {
      name: 'completeOrder',
      description: 'Mark an order as completed and finalize the sale in the inventory ledger. FARMER ONLY. DESTRUCTIVE — requires confirmation.',
      parameters: {
        type: 'OBJECT',
        required: ['orderId'],
        properties: {
          orderId: { type: 'STRING', description: 'Order ID to complete' },
          fulfilledQuantity: { type: 'NUMBER', description: 'Actual quantity delivered (may differ from reserved for partial fulfillment)' }
        }
      }
    },
    {
      name: 'markNoShow',
      description: 'Mark buyer as no-show and release reserved stock back to available. FARMER ONLY. DESTRUCTIVE — requires confirmation.',
      parameters: {
        type: 'OBJECT',
        required: ['orderId'],
        properties: {
          orderId: { type: 'STRING', description: 'Order ID of the no-show buyer' }
        }
      }
    },

    // ── Demand & Byproducts ───────────────────────────────────────────────────
    {
      name: 'sellMyHarvestMatch',
      description: 'Find best buyer demand opportunities matching the farmer\'s current harvest stock. FARMER ONLY.',
      parameters: {
        type: 'OBJECT',
        properties: {
          district: { type: 'STRING', description: 'District to search demand signals in' }
        }
      }
    },
    {
      name: 'listByproduct',
      description: 'List a harvest byproduct (paddy straw, coconut shells, banana stalks) for sale. FARMER ONLY.',
      parameters: {
        type: 'OBJECT',
        required: ['name', 'category', 'quantity', 'unit'],
        properties: {
          name: { type: 'STRING', description: 'Name of the byproduct' },
          category: { type: 'STRING', description: 'PADDY_STRAW | COCONUT_SHELL | BANANA_STALK | BAGASSE | GROUNDNUT_SHELL | OTHER' },
          quantity: { type: 'NUMBER', description: 'Quantity available' },
          unit: { type: 'STRING', description: 'Unit: KG | TON | BUNDLE | PIECE' },
          expectedPrice: { type: 'NUMBER', description: 'Expected price per unit' }
        }
      }
    }
  ];
}

/**
 * System instructions for ROOT — defines Uzhavan's persona and farm automation behavior
 */
export function buildUzhavanSystemInstruction(user, draftContext = {}, language = 'en') {
  const roleContext = user?.role === 'ROLE_FARMER'
    ? 'User is a FARMER. Can manage produce, stock, orders, requests, sandhai sales, and demand.'
    : user?.role === 'ROLE_BUYER'
      ? 'User is a BUYER. Can search marketplace, send purchase requests, confirm orders.'
      : 'User is GUEST. Public produce search only.';

  let draftNote = '';
  if (draftContext?.draftArgs && Object.keys(draftContext.draftArgs).length > 0) {
    draftNote = `\nACTIVE DRAFT (${draftContext.pendingIntent || 'createProduct'}): ${JSON.stringify(draftContext.draftArgs)}. If missing details are provided now, merge and execute immediately!`;
  }

  const langKey = (language || 'en').toLowerCase().trim();
  let langDirective = '';
  if (langKey === 'en') {
    langDirective = `CRITICAL LANGUAGE DIRECTIVE:
- The user is in the ENGLISH tab.
- You MUST reply ENTIRELY IN ENGLISH.
- DO NOT use Tamil, Hindi, Marathi, Tanglish, or other scripts.
- Translate any previous conversation context to pure English.`;
  } else if (langKey === 'ta') {
    langDirective = `CRITICAL LANGUAGE DIRECTIVE:
- The user is in the TAMIL (தமிழ்) tab.
- You MUST reply in pure, natural, respectful Tamil (தமிழ்).`;
  } else if (langKey === 'tanglish') {
    langDirective = `CRITICAL LANGUAGE DIRECTIVE:
- The user is in the TANGLISH tab.
- You MUST reply in conversational Tanglish (Tamil written in English letters).`;
  } else if (langKey === 'hi') {
    langDirective = `CRITICAL LANGUAGE DIRECTIVE:
- The user is in the HINDI (हिंदी) tab.
- You MUST reply in clear, polite, natural Hindi (हिंदी).`;
  } else if (langKey === 'mr') {
    langDirective = `CRITICAL LANGUAGE DIRECTIVE:
- The user is in the MARATHI (मराठी) tab.
- You MUST reply in clear, polite, natural Marathi (मराठी).`;
  } else if (langKey === 'te') {
    langDirective = `CRITICAL MANDATORY LANGUAGE DIRECTIVE:
- The user selected TELUGU (తెలుగు). Reply in natural, polite Telugu (తెలుగు).`;
  } else if (langKey === 'kn') {
    langDirective = `CRITICAL MANDATORY LANGUAGE DIRECTIVE:
- The user selected KANNADA (ಕನ್ನಡ). Reply in natural, polite Kannada (ಕನ್ನಡ).`;
  } else if (langKey === 'ml') {
    langDirective = `CRITICAL MANDATORY LANGUAGE DIRECTIVE:
- The user selected MALAYALAM (മലയാളം). Reply in natural, polite Malayalam (മലയാളം).`;
  } else if (langKey === 'bn') {
    langDirective = `CRITICAL MANDATORY LANGUAGE DIRECTIVE:
- The user selected BENGALI (বাংলা). Reply in natural, polite Bengali (বাংলা).`;
  } else if (langKey === 'gu') {
    langDirective = `CRITICAL MANDATORY LANGUAGE DIRECTIVE:
- The user selected GUJARATI (ગુજરાતી). Reply in natural, polite Gujarati (ગુજરાતી).`;
  } else {
    langDirective = `CRITICAL LANGUAGE DIRECTIVE:
- Match the user's selected language: ${language}.`;
  }

  return `You are ROOT (ரூட்), the intelligent agricultural assistant for Uzhavan 360.
Persona: Warm, respectful, human-like farm companion. Supports farmers across India.

${langDirective}

NOTE ON USER PROMPT OVERRIDE:
If the user explicitly requests another language in their message (e.g. "in marathi", "in hindi", "in english", "in tamil", "speak marathi"), ALWAYS prioritize and reply in that requested language!

${roleContext}${draftNote}

RULES:
1. PRODUCE LISTING (createProduct):
   - Only 3 fields are required: CROP NAME, QUANTITY, and PRICE per unit.
   - NEVER ask farmers for GPS coordinates or lat/lng. Use 'locationName' (e.g. Salem, Coimbatore, Madurai, Pune, Nashik).
   - When farmer gives produce details, EMIT A TOOL CALL to createProduct.
   - If partial details are given, ask briefly for only the missing field.
2. INVENTORY & PRICES:
   - Price update: call updateProduct.
   - Add stock: call addHarvest.
   - External sandhai cash sale: call recordOffPlatformSale.
   - List byproducts: call listByproduct.
3. ORDERS:
   - Requests: call getFarmerRequests / acceptRequest / rejectRequest.
   - Orders: call getMyOrders / completeOrder.
   - Demand: call sellMyHarvestMatch / getDemandSignals.
4. Currency is ₹ (INR), units are kg/bags/tons. Keep answers concise, human, and encouraging.`;
}
