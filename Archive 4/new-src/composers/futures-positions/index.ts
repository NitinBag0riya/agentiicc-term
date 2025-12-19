/**
 * Futures Positions Composer - Modular
 *
 * Main entry point for futures position management
 * Exports the composer with all handlers registered
 */
import { Composer } from 'telegraf';
import { BotContext } from '../../types/context';

// Import handler registrations
import {
  registerPositionsListHandler,
  registerToggleOrderTypeHandler,
  registerToggleMarginHandler,
  registerLeverageMenuHandler,
  registerSetLeverageHandler,
  registerLeverageCustomHandler,
  registerMarginManagementHandler,
  registerRefreshHandler,
  registerDefaultSettingsHandler,
  registerTPSLModeHandler,
  registerOrdersModeHandler,
} from './handlers';

import {
  registerApeHandler,
  registerApeCustomHandler,
  registerLongHandler,
  registerLongCustomHandler,
  registerShortHandler,
  registerShortCustomHandler,
  registerCloseHandler,
  registerSellCustomHandler,
} from './trading';

import {
  registerSetTPHandler,
  registerSetSLHandler,
  registerSetBothHandler,
  registerModifyTPHandler,
  registerModifySLHandler,
  registerRemoveTPHandler,
  registerRemoveSLHandler,
} from './tpsl';

import {
  registerManageOrdersHandler,
  registerCancelAllOrdersHandler,
  registerCancelCustomHandler,
} from './orders';

import { registerTextInputHandler } from './input';

// Export the main composer
export const futuresPositionsComposer = new Composer<BotContext>();

// Register all handlers
registerPositionsListHandler(futuresPositionsComposer);

// Toggle & Settings handlers
registerToggleOrderTypeHandler(futuresPositionsComposer);
registerToggleMarginHandler(futuresPositionsComposer);
registerLeverageMenuHandler(futuresPositionsComposer);
registerSetLeverageHandler(futuresPositionsComposer);
registerLeverageCustomHandler(futuresPositionsComposer);
registerMarginManagementHandler(futuresPositionsComposer);
registerRefreshHandler(futuresPositionsComposer);
registerDefaultSettingsHandler(futuresPositionsComposer);
registerTPSLModeHandler(futuresPositionsComposer);
registerOrdersModeHandler(futuresPositionsComposer);

// Trading handlers
registerApeHandler(futuresPositionsComposer);
registerApeCustomHandler(futuresPositionsComposer);
// registerApeConfirmHandler - Removed: now uses global write_confirm handler
registerLongHandler(futuresPositionsComposer);
registerLongCustomHandler(futuresPositionsComposer);
// registerLongConfirmHandler - Removed: now uses global write_confirm handler
registerShortHandler(futuresPositionsComposer);
registerShortCustomHandler(futuresPositionsComposer);
// registerShortConfirmHandler - Removed: now uses global write_confirm handler
registerCloseHandler(futuresPositionsComposer);
registerSellCustomHandler(futuresPositionsComposer);
// NOTE: Wizard launchers removed - now using toggle state directly in each handler

// TP/SL handlers
registerSetTPHandler(futuresPositionsComposer);
registerSetSLHandler(futuresPositionsComposer);
registerSetBothHandler(futuresPositionsComposer);
registerModifyTPHandler(futuresPositionsComposer);
registerModifySLHandler(futuresPositionsComposer);
registerRemoveTPHandler(futuresPositionsComposer);
registerRemoveSLHandler(futuresPositionsComposer);

// Order management handlers
registerManageOrdersHandler(futuresPositionsComposer);
registerCancelAllOrdersHandler(futuresPositionsComposer);
registerCancelCustomHandler(futuresPositionsComposer);
// NOTE: registerCancelConfirmHandler removed - now handled by global write_confirm handler

// Text input handler (must be last - it's a middleware)
registerTextInputHandler(futuresPositionsComposer);

// Export interface functions for use in other composers
export { showPositionManagement } from './interface';
