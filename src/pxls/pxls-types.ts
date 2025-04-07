import { z } from 'zod';

const pxlsInfoAuthServiceSchema = z.object({
    id: z.string(),
    name: z.string(),
    registrationEnabled: z.boolean(),
});

const pxlsInfoCustomEmojiSchema = z.object({
    emoji: z.string(),
    name: z.string(),
});

const pxlsInfoPaletteItemSchema = z.object({
    name: z.string(),
    value: z
        .string()
        .regex(/^[0-9a-f]{6}$/i)
        .transform((val) => `#${val.toLowerCase()}`),
});

const pxlsInfoCooldownInfoSchema = z.object({
    type: z.string(),
    staticCooldownSeconds: z.number(),
    activityCooldown: z.object({
        steepness: z.number(),
        multiplier: z.number(),
        globalOffset: z.number(),
        userOffset: z.number(),
    }),
});

export const pxlsInfoResponseSchema = z.object({
    canvasCode: z.string(),
    width: z.number(),
    height: z.number(),
    palette: z.array(pxlsInfoPaletteItemSchema),
    cooldownInfo: pxlsInfoCooldownInfoSchema,
    heatmapCooldown: z.number(),
    maxStacked: z.number(),
    authServices: z.record(pxlsInfoAuthServiceSchema),
    registrationEnabled: z.boolean(),
    chatEnabled: z.boolean(),
    chatRespectsCanvasBan: z.boolean(),
    chatCharacterLimit: z.number(),
    chatBannerText: z.array(z.string()),
    snipMode: z.boolean(),
    emoteSet7TV: z.string(),
    customEmoji: z.array(pxlsInfoCustomEmojiSchema),
    corsBase: z.string(),
    corsParam: z.string(),
    legal: z.object({
        termsUrl: z.string(),
        privacyUrl: z.string(),
    }),
    chatRatelimitMessage: z.string(),
    chatLinkMinimumPixelCount: z.number(),
    chatLinkSendToStaff: z.boolean(),
    chatDefaultExternalLinkPopup: z.boolean(),
});

export type PxlsInfoResponse = z.infer<typeof pxlsInfoResponseSchema>;
export type PxlsInfoAuthService = z.infer<typeof pxlsInfoAuthServiceSchema>;
export type PxlsInfoCustomEmoji = z.infer<typeof pxlsInfoCustomEmojiSchema>;
export type PxlsInfoPaletteItem = z.infer<typeof pxlsInfoPaletteItemSchema>;
export type PxlsInfoCooldownInfo = z.infer<typeof pxlsInfoCooldownInfoSchema>;
