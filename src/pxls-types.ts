export interface PxlsInfoResponse {
    authServices: Record<string, PxlsInfoAuthService>;
    registrationEnabled: boolean;
    chatEnabled: boolean;
    chatRespectsCanvasBan: boolean;
    chatCharacterLimit: number;
    chatBannerText: string[];
    snipMode: boolean;
    emoteSet7TV: string;
    customEmoji: PxlsInfoCustomEmoji[];
    corsBase: string;
    corsParam: string;
    legal: {
        termsUrl: string;
        privacyUrl: string;
    };
    chatRateLimitMessage: string;
    chatLinkMinimumPixelCount: number;
    chatLinkSendToStaff: boolean;
    chatDefaultExternalLinkPopup: boolean;
}

export interface PxlsInfoAuthService {
    id: string;
    name: string;
    registrationEnabled: boolean;
}

export interface PxlsInfoCustomEmoji {
    emoji: string;
    name: string;
}
