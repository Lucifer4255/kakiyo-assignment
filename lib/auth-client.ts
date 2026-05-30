"use client";
import { createAuthClient } from "better-auth/react";

// No baseURL — client calls same origin automatically (works for localhost + ngrok)
export const authClient = createAuthClient();
