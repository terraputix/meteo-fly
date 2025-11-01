import { weatherMapManager } from './manager';

// Create a store that is derived from the manager
const { subscribe } = weatherMapManager;
export const weatherMapStore = { subscribe };

// Export the manager for direct access to its methods
export { weatherMapManager };