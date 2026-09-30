/**
 * Uzhavan AI Tool Registry & Execution Layer
 * Level 1 Architecture Reference: Section 24, 25, 35, 36
 *
 * CRITICAL ARCHITECTURE RULE:
 * Every tool call goes:
 *   User Voice/Text → AI Intent → Tool → SAME Business Service → Database
 *
 * Tools NEVER access MongoDB directly.
 * Tools NEVER duplicate business logic.
 * Tools ALWAYS respect the same auth/RBAC boundary as REST routes.
 */

import * as productService from '../products/products.service.js';
import * as requestService from '../requests/requests.service.js';
import * as orderService from '../orders/orders.service.js';
import * as inventoryService from '../inventory/inventory.service.js';
import * as marketplaceService from '../marketplace/marketplace.service.js';
import * as demandService from '../demand/demand.service.js';
import * as byproductService from '../byproducts/byproducts.service.js';
import { ROLES } from '@uzhavan360/shared';
import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Tool execution gateway.
 * Validates role permission before dispatching to service.
 */
async function executeTool(tool, userCtx, params) {
  if (tool.requiredRole && tool.requiredRole !== 'any') {
    if (userCtx.role !== tool.requiredRole) {
      throw new AppError(
        `Uzhavan: "${tool.name}" is not available for your role (${userCtx.role}).`,
        403
      );
    }
  }

  if (!userCtx.id) {
    throw new AppError('Uzhavan: Authentication required to use this tool.', 401);
  }

  return tool.execute(userCtx, params);
}

/**
 * Tool Definitions
 * Each tool: name, description, requiredRole, execute(userCtx, params) → service call
 */
const TOOLS = {
  // ── Discovery ────────────────────────────────────────────────────────────
  searchProducts: {
    name: 'searchProducts',
    description: 'Search nearby produce listings on the marketplace map',
    requiredRole: 'any',
    execute: async (_userCtx, params) => marketplaceService.searchMarketplace(params)
  },

  getFarmerDetails: {
    name: 'getFarmerDetails',
    description: 'Get public profile and produce listings of a farmer',
    requiredRole: 'any',
    execute: async (_userCtx, { farmerId }) => {
      const { getFarmerProfile } = await import('../farmers/farmers.service.js');
      return getFarmerProfile(farmerId);
    }
  },

  getProductDetails: {
    name: 'getProductDetails',
    description: 'Get detailed view of a specific produce listing',
    requiredRole: 'any',
    execute: async (_userCtx, { productId }) => productService.getProductById(productId)
  },

  // ── Farmer Catalog Operations ────────────────────────────────────────────
  createProduct: {
    name: 'createProduct',
    description: 'Create a new produce listing on the marketplace',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, params) => {
      const normalizedParams = {
        name: params.name || params.cropName || params.produceName || params.crop,
        category: params.category,
        unit: params.unit || 'KG',
        pricePerUnit: params.pricePerUnit ?? params.price ?? params.rate,
        quantity: params.quantity ?? params.totalStock ?? params.availableStock ?? params.stock ?? params.qty,
        harvestDate: params.harvestDate,
        latitude: params.latitude ?? params.locationLat ?? params.lat,
        longitude: params.longitude ?? params.locationLng ?? params.lng,
        locationName: params.locationName || params.location || params.city || params.district,
        address: params.address,
        description: params.description,
        images: params.images
      };
      return productService.createProduct(userCtx.id, normalizedParams);
    }
  },

  updateProduct: {
    name: 'updateProduct',
    description: 'Update price, description, or availability of a product',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, { productId, produceName, cropName, ...updates }) => {
      let targetId = productId;
      if (!targetId && (produceName || cropName)) {
        const products = await productService.getFarmerProducts(userCtx.id);
        const nameQuery = (produceName || cropName).toLowerCase();
        const found = products.find((p) => p.name.toLowerCase().includes(nameQuery));
        if (found) targetId = found._id || found.id;
      }
      if (!targetId) {
        throw new AppError('Product not specified. Please tell me which product you want to update.', 400);
      }
      const normalizedUpdates = { ...updates };
      if (updates.price !== undefined && updates.pricePerUnit === undefined) {
        normalizedUpdates.pricePerUnit = updates.price;
      }
      return productService.updateProduct(targetId, userCtx.id, normalizedUpdates);
    }
  },

  deleteProduct: {
    name: 'deleteProduct',
    description: 'Remove a produce listing (blocked if active reservations exist)',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, { productId, produceName, cropName }) => {
      let targetId = productId;
      if (!targetId && (produceName || cropName)) {
        const products = await productService.getFarmerProducts(userCtx.id);
        const nameQuery = (produceName || cropName).toLowerCase();
        const found = products.find((p) => p.name.toLowerCase().includes(nameQuery));
        if (found) targetId = found._id || found.id;
      }
      if (!targetId) {
        throw new AppError('Product not specified. Please specify which listing to remove.', 400);
      }
      return productService.deleteProduct(targetId, userCtx.id);
    }
  },

  getMyProducts: {
    name: 'getMyProducts',
    description: 'List all of my produce batches',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx) => productService.getFarmerProducts(userCtx.id)
  },

  // ── Inventory Operations ─────────────────────────────────────────────────
  addHarvest: {
    name: 'addHarvest',
    description: 'Add new harvest stock to an existing produce batch',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, { productId, produceName, cropName, quantity, reason }) => {
      let targetId = productId;
      if (!targetId && (produceName || cropName)) {
        const products = await productService.getFarmerProducts(userCtx.id);
        const nameQuery = (produceName || cropName).toLowerCase();
        const found = products.find((p) => p.name.toLowerCase().includes(nameQuery));
        if (found) targetId = found._id || found.id;
      }
      if (!targetId) {
        throw new AppError('Product not specified. Please tell me which crop you want to add stock to.', 400);
      }
      return inventoryService.addHarvestBatch({
        productId: targetId,
        farmerId: userCtx.id,
        quantity: parseFloat(quantity),
        reason
      });
    }
  },

  recordOffPlatformSale: {
    name: 'recordOffPlatformSale',
    description: 'Record a direct farmgate/village sandhai cash sale outside Uzhavan 360',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, { productId, produceName, cropName, quantity, reason }) => {
      let targetId = productId;
      if (!targetId && (produceName || cropName)) {
        const products = await productService.getFarmerProducts(userCtx.id);
        const nameQuery = (produceName || cropName).toLowerCase();
        const found = products.find((p) => p.name.toLowerCase().includes(nameQuery));
        if (found) targetId = found._id || found.id;
      }
      if (!targetId) {
        throw new AppError('Product not specified. Please specify which crop was sold.', 400);
      }
      return inventoryService.recordOffPlatformSale({
        productId: targetId,
        farmerId: userCtx.id,
        quantity: parseFloat(quantity),
        reason: reason || 'Voice-recorded direct farmgate sale'
      });
    }
  },

  getInventoryHistory: {
    name: 'getInventoryHistory',
    description: 'View the full double-entry inventory audit trail for a product',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, { productId }) =>
      inventoryService.getInventoryHistory(productId, userCtx.id)
  },

  // ── Buyer Request Operations ─────────────────────────────────────────────
  submitRequest: {
    name: 'submitRequest',
    description: 'Send a purchase interest request to a farmer',
    requiredRole: ROLES.BUYER,
    execute: async (userCtx, { productId, note }) =>
      requestService.createRequest(userCtx.id, { productId, note })
  },

  cancelRequest: {
    name: 'cancelRequest',
    description: 'Cancel your own pending purchase request',
    requiredRole: ROLES.BUYER,
    execute: async (userCtx, { requestId, reason }) =>
      requestService.cancelRequest(requestId, userCtx.id, reason)
  },

  // ── Farmer Request Handling ──────────────────────────────────────────────
  getFarmerRequests: {
    name: 'getFarmerRequests',
    description: 'View all incoming buyer requests for my produce',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, params) =>
      requestService.getRequests(userCtx.id, ROLES.FARMER, params)
  },

  acceptRequest: {
    name: 'acceptRequest',
    description: 'Accept a buyer\'s produce request and trigger quantity confirmation',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, { requestId }) =>
      requestService.acceptRequest(requestId, userCtx.id)
  },

  rejectRequest: {
    name: 'rejectRequest',
    description: 'Reject a buyer request with a reason',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, { requestId, reason }) =>
      requestService.rejectRequest(requestId, userCtx.id, reason)
  },

  // ── Order Operations ─────────────────────────────────────────────────────
  confirmQuantity: {
    name: 'confirmQuantity',
    description: 'Confirm the quantity I want to buy and atomically reserve the stock',
    requiredRole: ROLES.BUYER,
    execute: async (userCtx, { requestId, quantity, idempotencyKey }) =>
      orderService.confirmQuantityAndReserve({
        requestId,
        buyerId: userCtx.id,
        quantity,
        idempotencyKey
      })
  },

  getMyOrders: {
    name: 'getMyOrders',
    description: 'List my orders as buyer or farmer',
    requiredRole: 'any',
    execute: async (userCtx, params) =>
      orderService.getOrders(userCtx.id, userCtx.role, params)
  },

  // THIS is the unified completeOrder — called by BOTH manual UI and Uzhavan
  completeOrder: {
    name: 'completeOrder',
    description: 'Mark an order as completed and finalize the sale in the inventory ledger',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, { orderId, fulfilledQuantity }) =>
      orderService.completeOrder(orderId, userCtx.id, fulfilledQuantity)
  },

  markNoShow: {
    name: 'markNoShow',
    description: 'Mark buyer as no-show; releases reserved stock back to available inventory',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, { orderId }) =>
      orderService.markBuyerNoShow(orderId, userCtx.id)
  },

  // ── Demand Intelligence ──────────────────────────────────────────────────
  getDemandSignals: {
    name: 'getDemandSignals',
    description: 'Get rolling 7-day demand trend signals for a crop category',
    requiredRole: 'any',
    execute: async (_userCtx, params) => demandService.getCommodityDemandSignals(params)
  },

  sellMyHarvestMatch: {
    name: 'sellMyHarvestMatch',
    description: 'Uzhavan: find the best buyer demand opportunities for my current harvest stock',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, params) =>
      demandService.matchFarmerHarvestOpportunities(userCtx.id, params)
  },

  // ── Byproducts ───────────────────────────────────────────────────────────
  listByproduct: {
    name: 'listByproduct',
    description: 'List a harvest byproduct (straw, shells, bagasse) on the byproduct marketplace',
    requiredRole: ROLES.FARMER,
    execute: async (userCtx, params) =>
      byproductService.createByproductListing(userCtx.id, params)
  },

  searchByproducts: {
    name: 'searchByproducts',
    description: 'Search for available harvest residues from nearby farmers',
    requiredRole: 'any',
    execute: async (_userCtx, params) => byproductService.searchByproducts(params)
  }
};

/**
 * Main Uzhavan tool dispatcher.
 * Called by the AI intent layer — not by REST routes directly.
 */
export async function callTool(toolName, userCtx, params = {}) {
  const tool = TOOLS[toolName];

  if (!tool) {
    throw new AppError(
      `Uzhavan: Tool "${toolName}" is not recognized. Say what you want to do, and I'll help.`,
      400
    );
  }

  return executeTool(tool, userCtx, params);
}

/**
 * Return the registry of available tools (for LLM function-calling schema generation in Level 4)
 */
export function getToolRegistry() {
  return Object.values(TOOLS).map(({ name, description, requiredRole }) => ({
    name,
    description,
    requiredRole
  }));
}

export { TOOLS };
