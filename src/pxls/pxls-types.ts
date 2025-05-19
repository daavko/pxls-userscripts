import type { InferOutput } from 'valibot';
import * as v from 'valibot';

const pxlsInfoAuthServiceSchema = v.object({
    id: v.string(),
    name: v.string(),
    registrationEnabled: v.boolean(),
});

const pxlsInfoCustomEmojiSchema = v.object({
    emoji: v.string(),
    name: v.string(),
});

const pxlsInfoPaletteItemSchema = v.object({
    name: v.string(),
    value: v.pipe(
        v.string(),
        v.regex(/^[0-9a-f]{6}$/i),
        v.transform((val) => `#${val.toLowerCase()}`),
    ),
});

const pxlsInfoCooldownInfoSchema = v.object({
    type: v.string(),
    staticCooldownSeconds: v.number(),
    activityCooldown: v.object({
        steepness: v.number(),
        multiplier: v.number(),
        globalOffset: v.number(),
        userOffset: v.number(),
    }),
});

export const pxlsInfoResponseSchema = v.object({
    canvasCode: v.string(),
    width: v.number(),
    height: v.number(),
    palette: v.array(pxlsInfoPaletteItemSchema),
    cooldownInfo: pxlsInfoCooldownInfoSchema,
    heatmapCooldown: v.number(),
    maxStacked: v.number(),
    authServices: v.record(v.string(), pxlsInfoAuthServiceSchema),
    registrationEnabled: v.boolean(),
    chatEnabled: v.boolean(),
    chatRespectsCanvasBan: v.boolean(),
    chatCharacterLimit: v.number(),
    chatBannerText: v.array(v.string()),
    snipMode: v.boolean(),
    emoteSet7TV: v.string(),
    customEmoji: v.array(pxlsInfoCustomEmojiSchema),
    corsBase: v.string(),
    corsParam: v.string(),
    legal: v.object({
        termsUrl: v.string(),
        privacyUrl: v.string(),
    }),
    chatRatelimitMessage: v.string(),
    chatLinkMinimumPixelCount: v.number(),
    chatLinkSendToStaff: v.boolean(),
    chatDefaultExternalLinkPopup: v.boolean(),
    captchaKey: v.nullish(v.string()),
});

export const pxlsLookupResponseSchema = v.object({
    id: v.number(),
    x: v.number(),
    y: v.number(),
    pixelCount: v.number(),
    pixelCountAlltime: v.number(),
    time: v.number(),
    username: v.string(),
    discordName: v.string(),
    faction: v.string(),
});

export type PxlsInfoResponse = InferOutput<typeof pxlsInfoResponseSchema>;
export type PxlsInfoAuthService = InferOutput<typeof pxlsInfoAuthServiceSchema>;
export type PxlsInfoCustomEmoji = InferOutput<typeof pxlsInfoCustomEmojiSchema>;
export type PxlsInfoPaletteItem = InferOutput<typeof pxlsInfoPaletteItemSchema>;
export type PxlsInfoCooldownInfo = InferOutput<typeof pxlsInfoCooldownInfoSchema>;
export type PxlsLookupResponse = InferOutput<typeof pxlsLookupResponseSchema>;
