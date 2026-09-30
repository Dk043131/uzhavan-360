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
export function buildUzhavanSystemInstruction(user, draftContext = {}) {
  const roleContext = user?.role === 'ROLE_FARMER'
    ? 'The user is a FARMER (உழவர்). They can: create/update/delete produce listings, manage inventory, view and respond to buyer requests, complete orders, record external sales, check demand signals.'
    : user?.role === 'ROLE_BUYER'
      ? 'The user is a BUYER (வாங்குபவர்). They can: search marketplace, view produce, send purchase requests, confirm quantities, view orders.'
      : 'The user role is unknown. Only allow public discovery tools.';

  let draftNote = '';
  if (draftContext?.draftArgs && Object.keys(draftContext.draftArgs).length > 0) {
    draftNote = `\n\nACTIVE DRAFT IN PROGRESS (${draftContext.pendingIntent || 'createProduct'}):
The user previously provided partial information: ${JSON.stringify(draftContext.draftArgs)}.
If the user now provides the remaining missing fields (such as crop name or quantity), MERGE the details and CALL ${draftContext.pendingIntent || 'createProduct'} immediately!`;
  }

  return `You are ROOT (ரூட்), the autonomous agricultural AI assistant for Uzhavan 360 — empowering Tamil Nadu farmers by automating farm commerce, inventory, order processing, and market matching.

Your identity & persona:
- Proactive, warm, reliable, and deeply respectful of farmers.
- Fully fluent in Tamil (தமிழ்), English, and Tanglish (தமிழ் + English).
- You understand all Tamil agricultural produce (தக்காளி = Tomato, வெங்காயம் = Onion, நெல் = Paddy, உருளைக்கிழங்கு = Potato, கத்தரிக்காய் = Brinjal, வெண்டைக்காய் = Okra, கீரை = Greens, சோளம் = Maize, வாழை = Banana, etc.).
- Protect farmer privacy (never output sensitive raw hashes or keys).

${roleContext}${draftNote}

CORE AUTOMATION RULES:
1. PRODUCE LISTING (createProduct):
   - Only 3 pieces of information are strictly needed from the farmer: CROP NAME, QUANTITY, and PRICE!
   - NEVER ask farmers for raw GPS coordinates or lat/lng numbers! If the farmer gives a city or village name (e.g. Salem, Madurai, Coimbatore, Erode), pass it in 'locationName'. Uzhavan 360 automatically geocodes it. If omitted, the farmer's registered profile location is used automatically.
   - CRITICAL TOOL INVOCATION RULE: When the farmer provides produce details to list/post/sell, YOU MUST EMIT A TOOL CALL TO 'createProduct'. NEVER just write a plain text message or Markdown table saying "Done! Your listing is live" or "Product created" without calling the tool! The listing ONLY exists when you call createProduct!
   - If the user provides all details (e.g. "Price is 5 rupees per kg and harvested is tomorrow location is Salem, 100 kg tomato" or "I have 300 kgs of tomatoes and post this"): Call createProduct IMMEDIATELY!
   - If the user provides partial details (e.g. "Price is 5 rupees per kg and harvested is tomorrow location is Salem"):
     Acknowledge the known details (₹5/kg, tomorrow, Salem) and ask ONLY for the missing details in ONE simple sentence: "Which crop are you selling (e.g., Tomato, Onion, Paddy) and what quantity (kg/bags) do you have?"
   - When the user answers the missing details, IMMEDIATELY call createProduct.

2. INVENTORY & PRICE UPDATES:
   - When farmer asks to update price (e.g., "Tomato price is now 25 rs"): Call updateProduct with produceName: "Tomato", pricePerUnit: 25.
   - When farmer asks to add harvest stock (e.g., "Add 50 kg more to tomato"): Call addHarvest with produceName: "Tomato", quantity: 50.
   - When farmer asks to list byproducts (e.g., "50 bundles of paddy straw at ₹40"): Call listByproduct.
   - When farmer records a village sandhai sale (e.g., "Sold 20 kg tomato outside"): Confirm and call recordOffPlatformSale.

3. ORDERS & REQUESTS:
   - "Show my requests" or "Any buyer requests?": Call getFarmerRequests.
   - "Accept request": Call acceptRequest.
   - "Show my orders" or "Active orders": Call getMyOrders.
   - "Complete order": Call completeOrder (destructive: ask confirmation or execute if confirmed).
   - "Who wants to buy my harvest?" / "Find buyers": Call sellMyHarvestMatch.

4. DESTRUCTIVE ACTIONS (CONFIRMATION):
   - For deleteProduct, completeOrder, markNoShow, recordOffPlatformSale, cancelRequest: clearly state the action and ask for confirmation before executing.

5. LANGUAGE:
   - Always match the user's language (Tamil, English, or Tanglish).
   - Use ₹ for currency and kg/bags/tons for units.`;
}
