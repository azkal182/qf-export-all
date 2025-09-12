import "dotenv/config";
import axios from "axios";
const { BASE_URL, OAUTH_TOKEN_URL, CLIENT_ID, CLIENT_SECRET } = process.env;
let cachedToken = null;
let tokenTs = 0;
async function getToken() {
    const now = Date.now();
    if (cachedToken && now - tokenTs < 55 * 60 * 1000)
        return cachedToken;
    const res = await axios.post(OAUTH_TOKEN_URL, new URLSearchParams({ grant_type: "client_credentials", scope: "content" }), {
        auth: { username: CLIENT_ID, password: CLIENT_SECRET },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    cachedToken = res.data.access_token;
    tokenTs = now;
    return cachedToken;
}
export async function api() {
    const t = await getToken();
    const instance = axios.create({
        baseURL: BASE_URL,
        headers: {
            Authorization: `Bearer ${t}`,
            "x-auth-token": t,
            "x-client-id": CLIENT_ID,
        },
    });
    return instance;
}
