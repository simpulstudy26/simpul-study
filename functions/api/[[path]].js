// /api/* 요청을 모두 cloudflare/api.js로 넘긴다 (Cloudflare Pages Functions).
import { handle } from '../../cloudflare/api.js';

export const onRequest = context => handle(context);
