// CORS headers helper
export function getCorsHeaders(origin?: string | null, requireCredentials = true): HeadersInit {
  // For development, allow localhost, 127.0.0.1, dev tunnel, and OpenAI CDN
  const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://f9828d7d6184.ngrok-free.app",
    "https://f9828d7d6184.ngrok-free.app",
    "https://cdn.platform.openai.com",
  ];
  
  // For image requests, allow OpenAI CDN and other common origins
  // For API requests, only allow specific origins
  let allowOrigin: string;
  
  if (origin) {
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    } else if (!requireCredentials && origin.startsWith("https://")) {
      // For image requests without credentials, allow any HTTPS origin
      allowOrigin = origin;
    } else {
      // Default to first allowed origin for security
      allowOrigin = allowedOrigins[0]!;
    }
  } else {
    // No origin header (same-origin request), use first allowed origin
    allowOrigin = allowedOrigins[0]!;
  }
  
  const headers: HeadersInit = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, chatkit-frame-instance-id",
  };
  
  // Only add credentials header if required (not needed for image requests)
  if (requireCredentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  
  return headers;
}

// Handle OPTIONS preflight requests
export function handleOptions(origin?: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export function addCorsHeaders(response: Response, origin?: string | null): Response {
  const headers = new Headers(response.headers);
  Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
}

