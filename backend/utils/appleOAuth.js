import appleSignin from "apple-signin-auth";
import fs from "fs";

function getBaseUrl() {
    return (process.env.BASE_URL || process.env.API_URL || `http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 3000}`).replace(/\/$/, "");
}

export function getApplePrivateKey() {
    if (process.env.APPLE_PRIVATE_KEY) {
        return process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
    }
    const keyPath = process.env.APPLE_PRIVATE_KEY_PATH;
    if (keyPath && fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, "utf8");
    }
    return null;
}

export function isAppleAuthConfigured() {
    return !!(
        process.env.APPLE_CLIENT_ID &&
        process.env.APPLE_TEAM_ID &&
        process.env.APPLE_KEY_ID &&
        getApplePrivateKey()
    );
}

export function getAppleCallbackUrl() {
    return process.env.APPLE_CALLBACK_URL || `${getBaseUrl()}/api/auth/apple/callback`;
}

export function getAppleClientSecret() {
    return appleSignin.getClientSecret({
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyIdentifier: process.env.APPLE_KEY_ID,
        privateKey: getApplePrivateKey(),
    });
}

export async function getAppleAuthorizeUrl(state) {
    return appleSignin.getAuthorizationUrl({
        clientID: process.env.APPLE_CLIENT_ID,
        redirectUri: getAppleCallbackUrl(),
        state,
        scope: "name email",
        responseMode: "form_post",
    });
}

export async function exchangeAppleAuthCode(code) {
    const clientSecret = getAppleClientSecret();
    const tokenResponse = await appleSignin.getAuthorizationToken(code, {
        clientID: process.env.APPLE_CLIENT_ID,
        clientSecret,
        redirectUri: getAppleCallbackUrl(),
    });

    const payload = await appleSignin.verifyIdToken(tokenResponse.id_token, {
        audience: process.env.APPLE_CLIENT_ID,
    });

    return {
        appleId: payload.sub,
        email: payload.email || null,
        emailVerified:
            payload.email_verified === true ||
            payload.email_verified === "true",
        idToken: tokenResponse.id_token,
    };
}

export function parseAppleUserName(userField) {
    if (!userField) return null;
    try {
        const parsed = typeof userField === "string" ? JSON.parse(userField) : userField;
        if (!parsed?.name) return null;
        return [parsed.name.firstName, parsed.name.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || null;
    } catch {
        return null;
    }
}
