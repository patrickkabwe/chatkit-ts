import {
    ChatKitServer,
    AgentContext,
    streamAgentResponse,
    StreamingResult,
    type ThreadMetadata,
    type ThreadStreamEvent,
    type UserMessageItem,
    type RunResultStreaming,
    type TContext,
    WidgetTemplate,
    streamWidget,
    type WidgetRoot,
    type WidgetItem,
    type Attachment,
    ThreadItemConverter,
    type AgentInputContentPart,
    type UserMessageTagContent,
    type HiddenContextItem,
    type SDKHiddenContextItem,
    type TaskItem,
    type WorkflowItem,
} from "../../src";
import { Agent, run, RunContext, tool } from "@openai/agents";
import { logger } from "../../src/logger";
import { Store, AttachmentStore, type StoreItemType } from "../../src/store";
import { SqliteStore } from "./services/sqlite.store";
import { z } from "zod";
import { Buffer } from "buffer";

type FitnessProfile = {
    id: string;
    name: string;
    age: number;
    location: string;
    fitnessLevel: string;
    currentActivities: string[];
    interests: string[];
    goals: string[];
    targetMetrics: string[];
    availableTime: string;
};

const defaultFitnessProfile: FitnessProfile = {
    id: "user_123",
    name: "Alex Chen",
    age: 32,
    location: "San Francisco, CA",
    fitnessLevel: "Intermediate",
    currentActivities: ["Running", "Yoga", "Weight training"],
    interests: ["Marathon training", "Strength building", "Meditation"],
    goals: ["Complete a half marathon in 3 months", "Build upper body strength", "Improve flexibility"],
    targetMetrics: ["Run 13.1 miles", "Bench press 185 lbs", "Touch toes"],
    availableTime: "4-5 hours per week",
};

function resolveFitnessProfile(context: unknown): FitnessProfile {
    const ctx = (context as any) ?? {};
    const incoming = (ctx.userProfile ?? ctx.user ?? ctx.profile ?? {}) as Partial<FitnessProfile>;
    
    // If we have an incoming profile with a real name, prioritize it completely
    const hasRealName = incoming.name && incoming.name !== "User" && incoming.name !== "Alex Chen";
    
    // Start with defaults, but always prioritize incoming values (from database)
    const merged = {
        ...defaultFitnessProfile,
        ...incoming,
    };

    const ensureArray = (value: unknown, fallback: string[]) =>
        Array.isArray(value) && value.length > 0 ? value : fallback;

    return {
        ...merged,
        // Ensure arrays are properly set
        currentActivities: ensureArray(incoming.currentActivities, merged.currentActivities),
        interests: ensureArray(incoming.interests, merged.interests),
        goals: ensureArray(incoming.goals, merged.goals),
        targetMetrics: ensureArray(incoming.targetMetrics, merged.targetMetrics),
        // Always prioritize the incoming name from database - never use default if we have a real name
        name: hasRealName ? incoming.name! : (incoming.name ?? merged.name),
    };
}

async function loadUserProfileFromDb(
    context: unknown,
    userStore: SqliteStore | null
): Promise<Partial<FitnessProfile>> {
    const userId = (context as any)?.userId;
    
    if (!userId || !userStore) {
        // Fallback to defaults if no user or store
        return {
            id: userId ?? "user_123",
            name: "User",
            age: 30,
            location: "Unknown",
            fitnessLevel: "Beginner",
            availableTime: "3-4 hours per week",
        };
    }

    try {
        const user = await userStore.getUserById(userId);
        if (!user) {
            return {
                id: userId,
                name: "User",
                age: 30,
                location: "Unknown",
                fitnessLevel: "Beginner",
                availableTime: "3-4 hours per week",
            };
        }

        // Extract fitness profile from user metadata or use defaults
        const metadata = user.metadata as Partial<FitnessProfile> | undefined;
        
        // Always prioritize the user's actual name from the database
        const userName = user.name || metadata?.name || "User";
        
        return {
            id: user.id,
            name: userName, // Always use the real user name from database
            age: metadata?.age ?? 30,
            location: metadata?.location ?? "Unknown",
            fitnessLevel: metadata?.fitnessLevel ?? "Beginner",
            currentActivities: metadata?.currentActivities ?? ["Walking"],
            interests: metadata?.interests ?? ["General fitness"],
            goals: metadata?.goals ?? ["Improve overall health"],
            targetMetrics: metadata?.targetMetrics ?? ["Exercise 3 times per week"],
            availableTime: metadata?.availableTime ?? "3-4 hours per week",
        };
    } catch (error) {
        logger.warn("loadUserProfileFromDb.error", JSON.stringify({ userId, error: String(error) }));
        // Return defaults on error
        return {
            id: userId,
            name: "User",
            age: 30,
            location: "Unknown",
            fitnessLevel: "Beginner",
            availableTime: "3-4 hours per week",
        };
    }
}

type WorkoutRecommendation = {
    activity: string;
    type: string;
    duration: string;
    intensity: string;
    why: string;
};

const planTemplate = new WidgetTemplate({
    version: "1.0",
    name: "Fitness Plan",
    template: data => JSON.stringify({
        type: "Col",
        gap: 1.5,
        children: [
            { type: "Title", value: data.heading },
            { type: "Text", value: `${data.profileName} • ${data.profileAge} years old • ${data.profileLocation}`, color: "secondary" },
            { type: "Text", value: `Focus: ${data.focus}` },
            {
                type: data.layout === "row" ? "Row" : "Col",
                gap: 1.5,
                wrap: data.layout === "row" ? "nowrap" : undefined,
                width: data.layout === "row" ? "100%" : undefined,
                children: (data.phases ?? []).map((phase: any) => ({
                    type: "Card",
                    flex: data.layout === "row" ? 0 : undefined,
                    minWidth: data.layout === "row" ? "260px" : undefined,
                    children: [
                        { type: "Title", value: `${phase.title} (${phase.timeframe})` },
                        { type: "Text", value: (phase.items ?? []).map((item: string) => `• ${item}`).join("\n") },
                    ],
                })),
            },
        ],
    }),
    jsonSchema: {},
    outputJsonPreview: null,
});

function buildPlanWidget(
    profile: FitnessProfile,
    heading: string,
    focus: string,
    phases: { title: string; timeframe: string; items: string[] }[],
    layout: "row" | "col" = "col",
): WidgetRoot {
    return planTemplate.build({
        heading,
        profileName: profile.name,
        profileAge: profile.age,
        profileLocation: profile.location,
        focus,
        phases,
        layout,
    });
}

const workoutTemplate = new WidgetTemplate({
    version: "1.0",
    name: "Workout Recommendations",
    template: data => JSON.stringify({
        type: "Card",
        children: [
            { type: "Title", value: `Workouts for ${data.profileName}` },
            { type: "Text", value: `${data.profileLocation} • ${data.availableTime} • Level: ${data.fitnessLevel}`, color: "secondary" },
            {
                type: "Col",
                gap: 2,
                children: (data.recommendations ?? []).map((rec: any) => ({
                    type: "Card",
                    children: [
                        { type: "Title", value: `${rec.activity} (${rec.type})` },
                        { type: "Text", value: `${rec.duration} • ${rec.intensity}` },
                        { type: "Text", value: rec.why },
                    ],
                })),
            },
        ],
    }),
    jsonSchema: {},
    outputJsonPreview: null,
});

function buildWorkoutRecommendationsWidget(profile: FitnessProfile, recommendations: WorkoutRecommendation[]): WidgetRoot {
    return workoutTemplate.build({
        profileName: profile.name,
        profileLocation: profile.location,
        availableTime: profile.availableTime,
        fitnessLevel: profile.fitnessLevel,
        recommendations,
    });
}

/**
 * Converts attachments into Agents SDK content parts by pulling either a
 * data URL or a fetchable file URL from the configured AttachmentStore.
 */
class AttachmentAwareConverter<TContext> extends ThreadItemConverter {
    constructor(private readonly fileStore: AttachmentStore<TContext> | null) {
        super();
    }

    private async resolveDataUrl(attachment: Attachment): Promise<string | null> {
        const storeWithData = this.fileStore as unknown as {
            getFileData?: (id: string) => Promise<Blob | null>;
        };
        if (!storeWithData?.getFileData) return null;

        try {
            const blob = await storeWithData.getFileData(attachment.id);
            if (!blob) return null;
            const buffer = Buffer.from(await blob.arrayBuffer());
            return `data:${attachment.mime_type};base64,${buffer.toString("base64")}`;
        } catch (error) {
            logger.warn("attachment.data_url_error", JSON.stringify({ attachmentId: attachment.id, error: String(error) }));
            return null;
        }
    }

    private resolveFileUrl(attachment: Attachment): string | null {
        if (attachment.preview_url) {
            return attachment.preview_url;
        }

        const storeWithUrl = this.fileStore as unknown as {
            getFileUrl?: (id: string) => string;
        };
        if (storeWithUrl?.getFileUrl) {
            return storeWithUrl.getFileUrl(attachment.id);
        }

        return null;
    }

    override async attachmentToMessageContent(attachment: Attachment): Promise<AgentInputContentPart> {
        const isImage = attachment.type === "image" || attachment.mime_type?.startsWith("image/");
        const dataUrl = await this.resolveDataUrl(attachment);
        const fallbackUrl = this.resolveFileUrl(attachment);

        if (isImage) {
            const url = dataUrl ?? fallbackUrl;
            if (!url) {
                throw new Error(`Unable to resolve file data or URL for attachment ${attachment.id}`);
            }
            // Agents API expects image_url or file_id on image parts; use a direct URL string.
            return {
                type: "input_image",
                image: url,
            } as any;
        }

        if (dataUrl) {
            // Prefer embedding file bytes when available.
            return {
                type: "input_file",
                file_data: dataUrl,
                filename: attachment.name ?? "file",
            } as any;
        }

        const url = fallbackUrl;
        if (!url) {
            throw new Error(`Unable to resolve file data or URL for attachment ${attachment.id}`);
        }

        return {
            type: "input_file",
            file_url: url,
            filename: attachment.name ?? "file",
        } as any;
    }

    override async tagToMessageContent(tag: UserMessageTagContent): Promise<AgentInputContentPart> {
        return {
            type: "input_text",
            text: tag.text ?? "",
        };
    }

    override async hiddenContextToInput(
        _item: HiddenContextItem | SDKHiddenContextItem
    ): Promise<null> {
        return null;
    }

    override async taskToInput(_item: TaskItem): Promise<null> {
        return null;
    }

    override async workflowToInput(_item: WorkflowItem): Promise<null> {
        return null;
    }
}


const workoutPlanTool = tool({
    name: "create_workout_plan",
    description: "Build a structured workout plan as a widget using the known user profile. Use whenever someone asks for a workout plan, training schedule, or fitness roadmap.",
    parameters: z.object({
        focus: z.string().describe("Primary fitness goal or focus area (e.g., marathon training, strength building, flexibility)"),
        horizon: z.string().describe("Target duration for the plan such as '8 weeks' or '12 weeks'."),
    }),
    execute: async (input, ctx?: RunContext<AgentContext<TContext>>) => {
        const profile = resolveFitnessProfile(ctx?.context.requestContext);
        const focus = input.focus?.trim() || profile.goals[0] || "General fitness";
        const horizon = input.horizon?.trim() || "12 weeks";

        const plan = buildPlanWidget(profile, `${horizon} ${focus} plan`, focus, [
            {
                title: "Foundation building",
                timeframe: "Weeks 1-4",
                items: [
                    `Establish baseline for ${focus} with 2-3 sessions per week.`,
                    "Focus on proper form and technique in all exercises.",
                    `Gradually increase duration/intensity by 10% each week.`,
                ],
            },
            {
                title: "Progressive overload",
                timeframe: "Weeks 5-8",
                items: [
                    `Increase training volume and intensity for ${focus}.`,
                    `Add cross-training activities: ${profile.currentActivities[0] ?? "strength training"}.`,
                    "Track progress with weekly measurements and adjust as needed.",
                ],
            },
            {
                title: "Peak performance",
                timeframe: "Weeks 9-12",
                items: [
                    "Push to peak performance while maintaining recovery.",
                    `Fine-tune approach based on progress toward ${focus}.`,
                    "Prepare for goal achievement or next phase planning.",
                ],
            },
        ]);

        await ctx?.context.streamWidget(plan);
        return `Workout plan ready for ${profile.name}: ${horizon}, focused on ${focus}.`;
    },
});

const nutritionPlanTool = tool({
    name: "create_nutrition_plan",
    description: "Creates a personalized nutrition plan widget for the user, based on their profile and fitness goals.",
    parameters: z.object({
        goal: z.string().describe("Nutrition goal (e.g., muscle gain, weight loss, endurance fuel, general wellness)"),
        weeklyMeals: z.number().int().min(7).max(35).describe("Number of meals per week to plan for"),
    }),
    execute: async (input, ctx?: RunContext<AgentContext<TContext>>) => {
        const profile = resolveFitnessProfile(ctx?.context.requestContext);
        const weeklyMeals = input.weeklyMeals ?? 21;
        const goal = input.goal.trim() || profile.goals[0] || "General wellness";

        const plan = buildPlanWidget(
            profile,
            `${goal} nutrition plan`,
            goal,
            [
                {
                    title: "Week 1: Establish baseline",
                    timeframe: `${weeklyMeals} meals`,
                    items: [
                        `Calculate daily caloric needs for ${goal}.`,
                        "Identify 5-7 go-to protein sources you enjoy.",
                        "Plan 3 balanced meals + 2 snacks per day template.",
                    ],
                },
                {
                    title: "Week 2: Meal prep strategy",
                    timeframe: `${weeklyMeals} meals`,
                    items: [
                        "Batch prep proteins, grains, and vegetables on Sunday.",
                        "Create 3-4 base recipes you can rotate weekly.",
                        "Prep portable snacks for active days.",
                    ],
                },
                {
                    title: "Week 3: Optimize timing",
                    timeframe: `${weeklyMeals} meals`,
                    items: [
                        `Time meals around ${profile.currentActivities[0] ?? "workout"} sessions.`,
                        "Experiment with pre/post workout nutrition.",
                        "Track energy levels and adjust portions.",
                    ],
                },
                {
                    title: "Week 4: Refine & maintain",
                    timeframe: `${weeklyMeals} meals`,
                    items: [
                        "Identify what's working and double down.",
                        "Add variety with 2-3 new recipes.",
                        "Establish sustainable weekly routine.",
                    ],
                },
            ],
            "row"
        );

        await ctx?.context.streamWidget(plan);
        return `Built a ${goal} nutrition plan for ${profile.name} with ${weeklyMeals} meals/week.`;
    },
});

const workoutRecommendationTool = tool({
    name: "recommend_workouts",
    description: "When the user asks for workout suggestions or activity recommendations, stream workout recommendation widgets using their profile.",
    parameters: z.object({
        focus: z.string().describe("Focus area or activity type (e.g., cardio, strength, flexibility, outdoor)"),
    }),
    execute: async (input, ctx?: RunContext<AgentContext<TContext>>) => {
        const profile = resolveFitnessProfile(ctx?.context.requestContext);
        const focus = input.focus?.trim() || profile.interests[0] || profile.currentActivities[0];

        const recommendations: WorkoutRecommendation[] = [
            {
                activity: "Interval Running",
                type: "Cardio",
                duration: "30-45 minutes",
                intensity: "High",
                why: `Perfect for ${focus} and fits your ${profile.availableTime} schedule.`,
            },
            {
                activity: "Full Body Strength",
                type: "Strength",
                duration: "45-60 minutes",
                intensity: "Moderate-High",
                why: `Builds on your ${profile.currentActivities[2] ?? "strength training"} foundation and supports ${focus}.`,
            },
            {
                activity: "Yoga Flow",
                type: "Flexibility",
                duration: "20-30 minutes",
                intensity: "Low-Moderate",
                why: `Complements your ${profile.currentActivities[1] ?? "yoga"} practice and aids recovery for ${focus}.`,
            },
        ];

        const widget = buildWorkoutRecommendationsWidget(profile, recommendations);
        await ctx?.context.streamWidget(widget);

        return `Surfaced ${recommendations.length} workout recommendations for ${profile.name} focused on ${focus}.`;
    },
});


// Minimal concrete ChatKit server used by the Bun demo.
export class MyChatKitServer<
    TContext = {
        userProfile: FitnessProfile;
    },
> extends ChatKitServer<TContext> {
    private userStore: SqliteStore | null;

    constructor(
        dataStore: Store<TContext>,
        fileStore: AttachmentStore<TContext> | null = null,
        userStore: SqliteStore | null = null
    ) {
        super(dataStore, fileStore);
        this.userStore = userStore;
    }

    async *respond(
        thread: ThreadMetadata,
        input: UserMessageItem | null,
        context: TContext,
    ): AsyncIterable<ThreadStreamEvent> {
        if (!input) {
            return;
        }

        const userText =
            (input as UserMessageItem)?.content?.map(part => part.text).join("\n\n").trim() ?? "";
        const hasAttachments =
            ((input as UserMessageItem)?.attachments?.length ?? 0) > 0;

        // Allow attachment-only messages by skipping the empty text guard.
        if (!userText && !hasAttachments) {
            return;
        }

        // Always load fresh user data from database, don't rely on thread metadata
        const dbProfile = await loadUserProfileFromDb(context, this.userStore);
        const mergedContext = { ...context, userProfile: dbProfile };

        // Persist the profile on the thread so it survives history reloads, but always use fresh DB data
        thread.metadata = {
            ...(thread.metadata ?? {}),
            userProfile: dbProfile,
        };
        await this.store.saveThread(thread, mergedContext);

        // Use the database profile directly, don't merge with defaults that might have old data
        const userProfile = resolveFitnessProfile({ userProfile: dbProfile });

        const recentItems = await this.store.loadThreadItems(
            thread.id,
            null,
            20,
            "desc",
            context
        );
        const converter = new AttachmentAwareConverter<TContext>(this.attachmentStore);
        const historyItems = recentItems.data.slice().reverse();
        const agentInputItems = await converter.toAgentInput([
            ...historyItems,
            input, // include the current user turn so the agent has input
        ]);

        logger.info("respond.start", JSON.stringify({ threadId: thread.id, userMessageId: (input as UserMessageItem).id }));

        const requestContext = { ...mergedContext, userProfile };
        const agentContext = new AgentContext<TContext>({
            thread,
            store: this.store,
            requestContext,
        });

        const demoAgent = new Agent<AgentContext<TContext>>({
            name: "Fitness & Wellness Assistant",
            instructions:
                `You are a friendly and knowledgeable fitness and wellness assistant for ${userProfile.name}, age ${userProfile.age}, located in ${userProfile.location} with ${userProfile.fitnessLevel} fitness level. ` +
                `Current activities: ${userProfile.currentActivities.join(", ")}. Interests: ${userProfile.interests.join(", ")}. Goals: ${userProfile.goals.join("; ")}. ` +
                `Available time: ${userProfile.availableTime}. ` +
                "Always keep answers concise, action-first, and pair text with widgets from the tools below when they clearly ask for them. " +
                "ONLY call tools when the user explicitly asks for a workout plan/training schedule (create_workout_plan), a nutrition/meal plan (create_nutrition_plan), or workout/activity recommendations (recommend_workouts). " +
                "If the user asks about general fitness questions, form tips, or any simple question, answer directly without calling tools or repeating prior plans. " +
                "Do not re-serve old plans unless the user asks to revisit them; focus on the latest user turn. " +
                "Do not repeat previous responses. Reply only once per question. If unsure, finish with a clear, conclusive statement. " +
                "Keep tone encouraging, supportive, and motivating while being practical and science-backed.",
            tools: [workoutPlanTool, nutritionPlanTool, workoutRecommendationTool],
        });


        try {
            const result = await run(demoAgent, agentInputItems, {
                stream: true,
                context: agentContext,
                maxTurns: 3
            });

            const readable = result.toTextStream();
            let full = "";
            const assistantId = agentContext.generateId("message", thread);
            const now = new Date();

            await agentContext.stream({
                type: "thread.item.added",
                item: {
                    type: "assistant_message",
                    id: assistantId,
                    thread_id: thread.id,
                    created_at: now,
                    content: [{ type: "output_text", text: "", annotations: [] }],
                },
            });

            for await (const chunk of readable) {
                const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
                full += text;
            }

            await agentContext.stream({
                type: "thread.item.done",
                item: {
                    type: "assistant_message",
                    id: assistantId,
                    thread_id: thread.id,
                    created_at: now,
                    content: [{ type: "output_text", text: full, annotations: [] }],
                },
            });

            agentContext._complete();

            const emptyResult: RunResultStreaming = {
                async *streamEvents() {
                    // No events from the result stream
                },
            };

            for await (const event of streamAgentResponse({
                context: agentContext,
                result: emptyResult,
            })) {
                yield event;
            }
        } catch (error) {
            logger.error("Agent error", error);
            agentContext._complete();

            const errorId = agentContext.generateId("message", thread);
            yield {
                type: "thread.item.done" as const,
                item: {
                    type: "assistant_message" as const,
                    id: errorId,
                    thread_id: thread.id,
                    created_at: new Date(),
                    content: [{ type: "output_text" as const, text: "Sorry, I hit an issue while processing your request.", annotations: [] }],
                },
            };
        }
    }

    async toMessageContent(_input: unknown): Promise<unknown> {
        throw new Error("NotImplementedError");
    }

    override async *action(
        thread: ThreadMetadata,
        action: { type: string; handler?: string; payload?: { url?: string } },
        _sender: WidgetItem | null,
        context: TContext
    ): AsyncIterable<ThreadStreamEvent> {
        if (action.handler === "client") {
            logger.debug("action.client_handled", JSON.stringify({ threadId: thread.id, actionType: action.type }, null, 2));
            return;
        }

        if (action.type === "sample_action") {
            logger.info("action.sample_action", JSON.stringify({ threadId: thread.id, action }, null, 2));

            const responseWidget: WidgetRoot = {
                type: "Card",
                children: [
                    {
                        type: "Col",
                        align: "center",
                        gap: 2,
                        children: [
                            { type: "Title", value: "Action Received!" },
                            { type: "Text", value: "The button was clicked successfully." },
                            { type: "Text", value: "This widget was streamed in response to the action.", color: "secondary" }
                        ]
                    }
                ]
            };

            const generateId = (itemType: StoreItemType) => this.store.generateItemId(itemType, thread, context);
            for await (const event of streamWidget(thread, responseWidget, null, generateId)) {
                yield event;
            }
        } else if (action.type === "navigate") {
            logger.info("action.navigate", JSON.stringify({ threadId: thread.id, action }, null, 2));

            const url = action.payload?.url;
            if (url) {
                yield {
                    type: "client_effect",
                    name: "navigate",
                    data: { url }
                } as ThreadStreamEvent;
            } else {
                logger.warn("action.navigate missing url", JSON.stringify({ threadId: thread.id, action }, null, 2));
            }
        } else {
            logger.warn("action.unknown", JSON.stringify({ threadId: thread.id, actionType: action.type }, null, 2));
        }
    }
}

export { StreamingResult };
