/**
 * Single source of truth for the Meta Graph API version across all
 * Facebook / Instagram / Conversions-API calls. Bump this one constant when a
 * version nears its ~2-year deprecation window instead of hunting version
 * strings scattered across files. See:
 * https://developers.facebook.com/docs/graph-api/changelog/versions/
 */
export const GRAPH_API_VERSION = 'v21.0';
export const GRAPH_API = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
