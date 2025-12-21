/**
 * Scene Index
 * 
 * Central export point for all bot scenes.
 * Import this file to get access to all scenes.
 */

// Authentication Scenes (Screens 1-14)
export { default as welcomeScene } from './welcome.scene';
export { default as exchangeSelectionAsterScene } from './exchange-selection-aster.scene';
export { default as exchangeSelectionHyperliquidScene } from './exchange-selection-hyperliquid.scene';
export { default as miniAppAuthAsterScene } from './mini-app-auth-aster.scene';
export { default as miniAppAuthHyperliquidScene } from './mini-app-auth-hyperliquid.scene';
export { default as linkWizardAsterStep1Scene } from './link-wizard-aster-step1.scene';
export { default as linkWizardAsterStep2Scene } from './link-wizard-aster-step2.scene';
export { default as linkWizardHyperliquidStep1Scene } from './link-wizard-hyperliquid-step1.scene';
export { default as linkWizardHyperliquidStep2Scene } from './link-wizard-hyperliquid-step2.scene';
export { default as validatingAsterScene } from './validating-aster.scene';
export { default as validatingHyperliquidScene } from './validating-hyperliquid.scene';
export { default as authErrorAsterScene } from './auth-error-aster.scene';
export { default as authErrorHyperliquidScene } from './auth-error-hyperliquid.scene';
export { default as confirmConnectAsterScene } from './confirm-connect-aster.scene';
export { default as confirmConnectHyperliquidScene } from './confirm-connect-hyperliquid.scene';

// Overview Scenes (Screens 15-21)
export { default as universalCitadelScene } from './universal-citadel.scene';
export { default as citadelAsterScene } from './citadel-aster.scene';
export { default as citadelHyperliquidScene } from './citadel-hyperliquid.scene';
export { default as allAssetsScene } from './all-assets.scene';
export { default as allPerpsScene } from './all-perps.scene';

// Trading Scenes (Screens 18-38)
export { default as searchResultsScene } from './search-results.scene';
export { default as searchPromptScene } from './search-prompt.scene';
export { default as searchPromptUniversalScene } from './search-prompt-universal.scene';
export { default as positionNoOpenScene } from './position-no-open.scene';
export { default as positionWithOpenScene } from './position-with-open.scene';
export { default as confirmOrderScene } from './confirm-order.scene';
export { default as orderExecutingScene } from './order-executing.scene';
export { default as orderSuccessScene } from './order-success.scene';
export { default as orderErrorScene } from './order-error.scene';
export { default as customAmountScene } from './custom-amount.scene';
export { default as leverageMenuScene } from './leverage-menu.scene';
export { default as ordersListScene } from './orders-list.scene';
export { default as confirmClosePositionScene } from './confirm-close-position.scene';

// Advanced Scenes (Screens 39-47)
export { default as tpslSetupScene } from './tpsl-setup.scene';

// Settings & Help Scenes (Screens 48-57)
export { default as settingsNewScene } from './settings-new.scene';
export { default as settingsUniversalScene } from './settings-universal.scene';
export { default as notificationSettingsScene } from './notification-settings.scene';
export { default as helpScene } from './help.scene';

// Additional scenes
export { default as searchResultsUniversalScene } from './search-results-universal.scene';
export { default as allAssetsUniversalScene } from './all-assets-universal.scene';
export { default as limitOrderPriceScene } from './limit-order-price.scene';
export { default as confirmCancelAllScene } from './confirm-cancel-all.scene';

// Import all scenes for Stage registration
import welcomeScene from './welcome.scene';
import exchangeSelectionAsterScene from './exchange-selection-aster.scene';
import exchangeSelectionHyperliquidScene from './exchange-selection-hyperliquid.scene';
import miniAppAuthAsterScene from './mini-app-auth-aster.scene';
import miniAppAuthHyperliquidScene from './mini-app-auth-hyperliquid.scene';
import linkWizardAsterStep1Scene from './link-wizard-aster-step1.scene';
import linkWizardAsterStep2Scene from './link-wizard-aster-step2.scene';
import linkWizardHyperliquidStep1Scene from './link-wizard-hyperliquid-step1.scene';
import linkWizardHyperliquidStep2Scene from './link-wizard-hyperliquid-step2.scene';
import validatingAsterScene from './validating-aster.scene';
import validatingHyperliquidScene from './validating-hyperliquid.scene';
import authErrorAsterScene from './auth-error-aster.scene';
import authErrorHyperliquidScene from './auth-error-hyperliquid.scene';
import confirmConnectAsterScene from './confirm-connect-aster.scene';
import confirmConnectHyperliquidScene from './confirm-connect-hyperliquid.scene';
import universalCitadelScene from './universal-citadel.scene';
import citadelAsterScene from './citadel-aster.scene';
import citadelHyperliquidScene from './citadel-hyperliquid.scene';
import allAssetsScene from './all-assets.scene';
import allPerpsScene from './all-perps.scene';
import searchResultsScene from './search-results.scene';
import searchPromptScene from './search-prompt.scene';
import searchPromptUniversalScene from './search-prompt-universal.scene';
import positionNoOpenScene from './position-no-open.scene';
import positionWithOpenScene from './position-with-open.scene';
import confirmOrderScene from './confirm-order.scene';
import orderExecutingScene from './order-executing.scene';
import orderSuccessScene from './order-success.scene';
import orderErrorScene from './order-error.scene';
import customAmountScene from './custom-amount.scene';
import leverageMenuScene from './leverage-menu.scene';
import ordersListScene from './orders-list.scene';
import confirmClosePositionScene from './confirm-close-position.scene';
import tpslSetupScene from './tpsl-setup.scene';
import settingsNewScene from './settings-new.scene';
import settingsUniversalScene from './settings-universal.scene';
import notificationSettingsScene from './notification-settings.scene';
import helpScene from './help.scene';
import searchResultsUniversalScene from './search-results-universal.scene';
import allAssetsUniversalScene from './all-assets-universal.scene';
import limitOrderPriceScene from './limit-order-price.scene';
import confirmCancelAllScene from './confirm-cancel-all.scene';

/**
 * All scenes array for Stage registration
 * Total: 43 scenes
 */
export const allScenes = [
  // Authentication (15)
  welcomeScene,
  exchangeSelectionAsterScene,
  exchangeSelectionHyperliquidScene,
  miniAppAuthAsterScene,
  miniAppAuthHyperliquidScene,
  linkWizardAsterStep1Scene,
  linkWizardAsterStep2Scene,
  linkWizardHyperliquidStep1Scene,
  linkWizardHyperliquidStep2Scene,
  validatingAsterScene,
  validatingHyperliquidScene,
  authErrorAsterScene,
  authErrorHyperliquidScene,
  confirmConnectAsterScene,
  confirmConnectHyperliquidScene,
  
  // Overview (7)
  universalCitadelScene,
  citadelAsterScene,
  citadelHyperliquidScene,
  allAssetsScene,
  allPerpsScene,
  allAssetsUniversalScene,
  
  // Trading (17)
  searchResultsScene,
  searchPromptScene,
  searchPromptUniversalScene,
  searchResultsUniversalScene,
  positionNoOpenScene,
  positionWithOpenScene,
  confirmOrderScene,
  orderExecutingScene,
  orderSuccessScene,
  orderErrorScene,
  customAmountScene,
  leverageMenuScene,
  limitOrderPriceScene,
  ordersListScene,
  confirmClosePositionScene,
  confirmCancelAllScene,
  
  // Advanced (1)
  tpslSetupScene,
  
  // Settings & Help (4)
  settingsNewScene,
  settingsUniversalScene,
  notificationSettingsScene,
  helpScene,
];

export default allScenes;


