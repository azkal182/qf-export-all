// import "dotenv/config";
// import axios, { AxiosInstance } from "axios";

// const { BASE_URL, OAUTH_TOKEN_URL, CLIENT_ID, CLIENT_SECRET } = process.env;

// let cachedToken: string | null = null;
// let tokenTs = 0;

// async function getToken(): Promise<string> {
//   const now = Date.now();
//   if (cachedToken && now - tokenTs < 55 * 60 * 1000) return cachedToken;

//   const res = await axios.post(
//     OAUTH_TOKEN_URL!,
//     new URLSearchParams({ grant_type: "client_credentials", scope: "content" }),
//     {
//       auth: { username: CLIENT_ID!, password: CLIENT_SECRET! },
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     }
//   );
//   cachedToken = res.data.access_token;
//   tokenTs = now;
//   return cachedToken!;
// }

// export async function api(): Promise<AxiosInstance> {
//   const t = await getToken();
//   const instance = axios.create({
//     baseURL: BASE_URL,
//     headers: {
//       Authorization: `Bearer ${t}`,
//       "x-auth-token": t,
//       "x-client-id": CLIENT_ID!,
//     },
//   });
//   return instance;
// }

import "dotenv/config";
import axios, { AxiosError, AxiosHeaders, AxiosInstance } from "axios";
import { log } from "./logger.js";

const { BASE_URL, OAUTH_TOKEN_URL, CLIENT_ID, CLIENT_SECRET } = process.env;

const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);
const BACKOFF_BASE_MS = Number(process.env.BACKOFF_BASE_MS || 500);

let cachedToken: string | null = null;
let tokenExpiryTs = 0; // epoch ms
let instance: AxiosInstance | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jittered(ms: number) {
  const j = Math.floor(Math.random() * 100); // ±0..99ms
  return ms + j;
}

async function fetchToken(): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const res = await axios.post(
    OAUTH_TOKEN_URL!,
    new URLSearchParams({ grant_type: "client_credentials", scope: "content" }),
    {
      auth: { username: CLIENT_ID!, password: CLIENT_SECRET! },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  return res.data;
}

async function getToken(force = false): Promise<string> {
  const now = Date.now();
  if (!force && cachedToken && now < tokenExpiryTs) return cachedToken;

  const data = await fetchToken();
  cachedToken = data.access_token;
  // jika expires_in ada, sisakan buffer 60 detik
  const ttl = (data.expires_in ?? 3600) - 60;
  tokenExpiryTs = now + ttl * 1000;
  log.info("oauth: token refreshed", { ttl_sec: ttl });
  return cachedToken!;
}

export async function api(): Promise<AxiosInstance> {
  if (instance) return instance;

  instance = axios.create({ baseURL: BASE_URL });

  // attach token on request
  instance.interceptors.request.use(async (config) => {
    const t = await getToken(false);
    // Start from existing headers, then set ours
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${t}`);
    headers.set("x-auth-token", t);
    headers.set("x-client-id", CLIENT_ID!);

    config.headers = headers;
    // track retries
    (config as any).__retryCount = (config as any).__retryCount || 0;
    (config as any).__refreshed = (config as any).__refreshed || false;
    return config;
  });

  // response handler with retry & refresh
  instance.interceptors.response.use(
    (resp) => resp,
    async (error: AxiosError) => {
      const cfg: any = error.config || {};
      const status = error.response?.status || 0;
      const code = (error as any).code;

      // === 401 Unauthorized → try refresh token once then retry
      if (status === 401 && !cfg.__refreshed) {
        try {
          log.warn("oauth: 401 received, refreshing token...");
          await getToken(true);
          cfg.__refreshed = true;
          return instance!.request(cfg);
        } catch (e) {
          log.error("oauth: token refresh failed", {
            err: (e as any)?.message,
          });
          throw error;
        }
      }

      // === Decide if retryable (5xx or network-ish)
      const is5xx = status >= 500 && status < 600;
      const isNetErr = [
        "ECONNRESET",
        "ECONNABORTED",
        "ETIMEDOUT",
        "ENOTFOUND",
        "EAI_AGAIN",
      ].includes(String(code));
      const shouldRetry = is5xx || isNetErr;

      if (shouldRetry && cfg.__retryCount < MAX_RETRIES) {
        cfg.__retryCount += 1;
        const delay = jittered(
          BACKOFF_BASE_MS * Math.pow(2, cfg.__retryCount - 1)
        );
        log.warn("http: retrying request", {
          url: cfg.url,
          attempt: cfg.__retryCount,
          delay_ms: delay,
          status,
          code,
        });
        await sleep(delay);
        return instance!.request(cfg);
      }

      // no more retries → bubble up
      log.error("http: request failed (no more retries)", {
        url: cfg.url,
        status,
        code,
        attempts: cfg.__retryCount,
        message: error.message,
        data: (error.response as any)?.data,
      });
      throw error;
    }
  );

  return instance;
}
