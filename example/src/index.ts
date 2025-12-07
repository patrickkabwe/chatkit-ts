import { serve } from "bun";
import OpenAI from "openai";
import { MyChatKitServer, StreamingResult } from "./chat-server";
import { SqliteStore } from "./services/sqlite.store";
import { DiskAttachmentStore } from "./services/disk-attachment.store";
import { getCorsHeaders, handleOptions } from "./server-utils";
import { hashPassword, verifyPassword, createSession, getUserIdFromSession, getSessionFromRequest, setSessionStore } from "./auth-utils";
import index from "./index.html";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const dbPath = "./chatkit.db";
const dataStore = new SqliteStore(dbPath);
const fileStore = new DiskAttachmentStore("./attachments");
const chatkitServer = new MyChatKitServer(dataStore, fileStore, dataStore);

// Initialize session store for persistent sessions
setSessionStore(dataStore);

const server = serve({
  idleTimeout: 60, // Increase timeout to 60 seconds for image processing
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    // Auth endpoints
    "/api/auth/register": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return handleOptions(origin);
      },
      async POST(req) {
        const origin = req.headers.get("origin");
        try {
          const body = await req.json();
          const { email, password, name } = body;

          if (!email || !password) {
            return new Response(JSON.stringify({ error: "Email and password are required" }), {
              status: 400,
              headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
            });
          }

          // Check if user exists
          const existingUser = await dataStore.getUserByEmail(email);
          if (existingUser) {
            return new Response(JSON.stringify({ error: "User already exists" }), {
              status: 400,
              headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
            });
          }

          // Create user
          const passwordHash = hashPassword(password);
          const user = await dataStore.createUser(email, passwordHash, name);

          // Create session
          const sessionId = await createSession(user.id);
          const isProduction = process.env.NODE_ENV === "production";
          const secureFlag = isProduction ? "Secure;" : "";

          return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }), {
            status: 201,
            headers: {
              ...getCorsHeaders(origin),
              "Content-Type": "application/json",
              "Set-Cookie": `sessionId=${sessionId}; HttpOnly; ${secureFlag} SameSite=Lax; Max-Age=${24 * 60 * 60}; Path=/`,
            },
          });
        } catch (error) {
          console.error("Registration error:", error);
          return new Response(JSON.stringify({ error: "Registration failed" }), {
            status: 500,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }
      },
    },

    "/api/auth/login": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return handleOptions(origin);
      },
      async POST(req) {
        const origin = req.headers.get("origin");
        try {
          const body = await req.json();
          const { email, password } = body;

          if (!email || !password) {
            return new Response(JSON.stringify({ error: "Email and password are required" }), {
              status: 400,
              headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
            });
          }

          // Get user
          const user = await dataStore.getUserByEmail(email);
          if (!user) {
            return new Response(JSON.stringify({ error: "Invalid email or password" }), {
              status: 401,
              headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
            });
          }

          // Verify password
          if (!verifyPassword(password, user.password_hash)) {
            return new Response(JSON.stringify({ error: "Invalid email or password" }), {
              status: 401,
              headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
            });
          }

          // Create session
          const sessionId = await createSession(user.id);
          const isProduction = process.env.NODE_ENV === "production";
          const secureFlag = isProduction ? "Secure;" : "";

          return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }), {
            headers: {
              ...getCorsHeaders(origin),
              "Content-Type": "application/json",
              "Set-Cookie": `sessionId=${sessionId}; HttpOnly; ${secureFlag} SameSite=Lax; Max-Age=${24 * 60 * 60}; Path=/`,
            },
          });
        } catch (error) {
          console.error("Login error:", error);
          return new Response(JSON.stringify({ error: "Login failed" }), {
            status: 500,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }
      },
    },

    "/api/auth/logout": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return handleOptions(origin);
      },
      async POST(req) {
        const origin = req.headers.get("origin");
        const isProduction = process.env.NODE_ENV === "production";
        const secureFlag = isProduction ? "Secure;" : "";
        return new Response(JSON.stringify({ success: true }), {
          headers: {
            ...getCorsHeaders(origin),
            "Content-Type": "application/json",
            "Set-Cookie": `sessionId=; HttpOnly; ${secureFlag} SameSite=Lax; Max-Age=0; Path=/`,
          },
        });
      },
    },

    "/api/auth/me": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return handleOptions(origin);
      },
      async GET(req) {
        const origin = req.headers.get("origin");
        const sessionId = getSessionFromRequest(req);
        const userId = await getUserIdFromSession(sessionId);

        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        const user = await dataStore.getUserById(userId);
        if (!user) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }), {
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      },
    },

    "/api/profile/complete": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return handleOptions(origin);
      },
      async GET(req) {
        const origin = req.headers.get("origin");
        const sessionId = getSessionFromRequest(req);
        const userId = await getUserIdFromSession(sessionId);

        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        const user = await dataStore.getUserById(userId);
        if (!user) {
          return new Response(JSON.stringify({ complete: false }), {
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        const metadata = user.metadata as any;
        const isComplete = !!(
          metadata?.age &&
          metadata?.location &&
          metadata?.fitnessLevel &&
          metadata?.currentActivities &&
          Array.isArray(metadata.currentActivities) &&
          metadata.currentActivities.length > 0 &&
          metadata?.interests &&
          Array.isArray(metadata.interests) &&
          metadata.interests.length > 0 &&
          metadata?.goals &&
          Array.isArray(metadata.goals) &&
          metadata.goals.length > 0 &&
          metadata?.targetMetrics &&
          Array.isArray(metadata.targetMetrics) &&
          metadata.targetMetrics.length > 0 &&
          metadata?.availableTime
        );

        return new Response(JSON.stringify({ complete: isComplete }), {
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      },
    },

    "/api/profile/update": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return handleOptions(origin);
      },
      async POST(req) {
        const origin = req.headers.get("origin");
        const sessionId = getSessionFromRequest(req);
        const userId = await getUserIdFromSession(sessionId);

        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        try {
          const body = await req.json();
          const { age, location, fitnessLevel, currentActivities, interests, goals, targetMetrics, availableTime } = body;

          if (!age || !location || !fitnessLevel || !availableTime) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), {
              status: 400,
              headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
            });
          }

          if (
            !Array.isArray(currentActivities) ||
            currentActivities.length === 0 ||
            !Array.isArray(interests) ||
            interests.length === 0 ||
            !Array.isArray(goals) ||
            goals.length === 0 ||
            !Array.isArray(targetMetrics) ||
            targetMetrics.length === 0
          ) {
            return new Response(JSON.stringify({ error: "All array fields must have at least one item" }), {
              status: 400,
              headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
            });
          }

          const user = await dataStore.getUserById(userId);
          if (!user) {
            return new Response(JSON.stringify({ error: "User not found" }), {
              status: 404,
              headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
            });
          }

          const existingMetadata = user.metadata || {};
          const updatedMetadata = {
            ...existingMetadata,
            age,
            location,
            fitnessLevel,
            currentActivities,
            interests,
            goals,
            targetMetrics,
            availableTime,
          };

          await dataStore.updateUserMetadata(userId, updatedMetadata);

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Profile update error:", error);
          return new Response(JSON.stringify({ error: "Failed to update profile" }), {
            status: 500,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }
      },
    },

    "/api/chatkit": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return handleOptions(origin);
      },
      async POST(req) {
        const sessionId = getSessionFromRequest(req);
        const userId = await getUserIdFromSession(sessionId);

        if (!userId) {
          const origin = req.headers.get("origin");
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        const body = await req.text();
        const result = await chatkitServer.process(body, { userId });

        if (result instanceof StreamingResult) {
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              try {
                for await (const chunk of result) {
                  try {
                    controller.enqueue(chunk);
                  } catch (enqueueError: any) {
                    // Controller might be closed, stop iterating
                    if (enqueueError.code === "ERR_INVALID_STATE") {
                      break;
                    }
                    throw enqueueError;
                  }
                }
              } catch (err) {
                console.error("Error while streaming ChatKit response:", err);
              } finally {
                try {
                  controller.close();
                } catch (closeError) {
                  // Controller might already be closed, ignore
                }
              }
            },
          });

          const origin = req.headers.get("origin");
          return new Response(stream, {
            headers: {
              ...getCorsHeaders(origin),
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          });
        }

        const origin = req.headers.get("origin");
        return new Response(result.json as unknown as BodyInit, {
          headers: {
            ...getCorsHeaders(origin),
            "Content-Type": "application/json",
          },
        });
      },
    },

    "/api/chatkit/session": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return handleOptions(origin);
      },
      async POST(req) {
        const sessionId = getSessionFromRequest(req);
        const userId = await getUserIdFromSession(sessionId);

        if (!userId) {
          const origin = req.headers.get("origin");
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        const session = await openai.beta.chatkit.sessions.create({
          user: userId,
          workflow: {
            id: "test",
          },
          chatkit_configuration: {
            file_upload: {
              enabled: true,
            },
          },
        });

        const origin = req.headers.get("origin");
        return Response.json(
          {
            client_secret: session.client_secret,
          },
          {
            headers: getCorsHeaders(origin),
          }
        );
      },
    },

    "/api/chatkit/attachments/:id/upload": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return handleOptions(origin);
      },
      async POST(req) {
        const origin = req.headers.get("origin");
        
        // Require authentication
        const sessionId = getSessionFromRequest(req);
        const userId = await getUserIdFromSession(sessionId);

        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        try {
          const attachmentId = req.params.id;
          const formData = await req.formData();
          const file = formData.get("file") as File | null;

          if (!file) {
            return new Response("File is required", {
              status: 400,
              headers: getCorsHeaders(origin),
            });
          }

          const arrayBuffer = await file.arrayBuffer();
          const fileData = new Uint8Array(arrayBuffer);

          await fileStore.storeFileData(attachmentId, fileData);

          // Load the attachment to update it (with user context)
          const attachment = await dataStore.loadAttachment(attachmentId, { userId });
          const attachmentType =
            (attachment as any).type ??
            (attachment.mime_type?.startsWith("image/") ? "image" : "file");

          // Update attachment metadata
          const updatedAttachment = {
            ...attachment,
            type: attachmentType,
            upload_url: null,
          };
          await dataStore.saveAttachment(updatedAttachment, { userId });

        
          if (updatedAttachment.preview_url) {
            attachment.preview_url = updatedAttachment.preview_url;
          }

          return Response.json(attachment, {
            headers: getCorsHeaders(origin),
          });
        } catch (error) {
          console.error("Error uploading file:", error);
          return new Response("Error uploading file", {
            status: 500,
            headers: getCorsHeaders(origin),
          });
        }
      },
    },

    "/api/chatkit/attachments/:id/file": {
      async OPTIONS(req) {
        const origin = req.headers.get("origin");
        return new Response(null, {
          status: 204,
          headers: getCorsHeaders(origin, false),
        });
      },
      async GET(req) {
        const origin = req.headers.get("origin");
        
        // Require authentication
        const sessionId = getSessionFromRequest(req);
        const userId = await getUserIdFromSession(sessionId);

        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        try {
          const attachmentId = req.params.id;
          
          let attachmentMime: string | undefined;
          let attachmentName: string | undefined;
          try {
            const attachment = await dataStore.loadAttachment(attachmentId, { userId });
            attachmentMime = attachment.mime_type;
            attachmentName = attachment.name;
          } catch (error) {
            console.warn(`Attachment metadata not found for ${attachmentId}:`, error);
          }
          
          const fileData = await fileStore.getFileData(attachmentId);
          
          if (!fileData) {
            return new Response("File not found", {
              status: 404,
              headers: getCorsHeaders(origin, false),
            });
          }

          const headers = new Headers();

          Object.entries(getCorsHeaders(origin, false)).forEach(([key, value]) => {
            headers.set(key, value);
          });

          headers.set("Content-Type", attachmentMime ?? "application/octet-stream");
          const filename = attachmentName ?? (fileData as any).name ?? `${attachmentId}`;
          headers.set("Content-Disposition", `inline; filename="${filename}"`);
    

          return new Response(fileData, {headers});
        } catch (error) {
          console.error("Error serving file:", error);
          return new Response("Error serving file", {
            status: 500,
            headers: getCorsHeaders(origin, false),
          });
        }
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
