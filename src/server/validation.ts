import { z } from "zod";

/**
 * Web link supplied by a user. Only http(s) is accepted so stored links can never
 * become `javascript:`, `data:` or other script-capable URLs when rendered as hrefs.
 */
export const httpUrl = () => z.url({ protocol: /^https?$/, error: "Enter a full web address starting with https://" }).max(2048);

/** Optional form link: an empty string means "no link". */
export const optionalHttpUrl = () => z.union([z.literal(""), httpUrl()]);

