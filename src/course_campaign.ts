import { z } from "zod";
import type { DeliveryEvent, EmailClient } from "./infrai_email";

export const courseDeliverySchema = z.object({
  campaign_id: z.string().min(1),
  course_title: z.string().min(1),
  learner: z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }),
  deadline: z.string().datetime({ offset: true }),
});

export const reportRequestSchema = z.object({
  message_id: z.string().min(1),
  learner_email: z.string().email(),
  deadline: z.string().datetime({ offset: true }),
  as_of: z.string().datetime({ offset: true }).optional(),
});

export type CourseDelivery = z.infer<typeof courseDeliverySchema>;
export type ReportRequest = z.infer<typeof reportRequestSchema>;

export type LearnerDeliveryReport = {
  message_id: string;
  learner_email: string;
  deadline: string;
  status: "bounced" | "opened" | "awaiting_open" | "deadline_missed";
  educator_action: "correct_address" | "none" | "remind_learner";
};

function eventName(event: DeliveryEvent): string {
  return String(event.type ?? event.event ?? "").toLowerCase();
}

function eventArray(value: unknown): DeliveryEvent[] {
  if (Array.isArray(value)) return value as DeliveryEvent[];
  if (value && typeof value === "object" && "events" in value) {
    const events = (value as { events?: unknown }).events;
    if (Array.isArray(events)) return events as DeliveryEvent[];
  }
  return [];
}

export function decideLearnerStatus(
  request: ReportRequest,
  events: DeliveryEvent[],
): LearnerDeliveryReport {
  const names = events.map(eventName);
  const bounced = names.some((name) => name === "bounce" || name === "bounced");
  const opened = names.some((name) => name === "open" || name === "opened");
  const overdue = new Date(request.as_of ?? new Date().toISOString()) > new Date(request.deadline);

  const status = bounced
    ? "bounced"
    : opened
      ? "opened"
      : overdue
        ? "deadline_missed"
        : "awaiting_open";

  return {
    message_id: request.message_id,
    learner_email: request.learner_email,
    deadline: request.deadline,
    status,
    educator_action: bounced ? "correct_address" : status === "deadline_missed" ? "remind_learner" : "none",
  };
}

export async function sendCourseDelivery(infrai: EmailClient, input: CourseDelivery) {
  const result = await infrai.email.send(
    {
      to: input.learner.email,
      subject: `${input.course_title}: materials and deadline`,
      html: `<h1>${input.course_title}</h1><p>Hello ${input.learner.name}, your deadline is <strong>${input.deadline}</strong>.</p>`,
    },
    `course-delivery:${input.campaign_id}:${input.learner.email}`,
  );

  return {
    campaign_id: input.campaign_id,
    message_id: result.message_id,
    learner_email: input.learner.email,
    deadline: input.deadline,
  };
}

export async function buildEducatorReport(infrai: EmailClient, input: ReportRequest) {
  const result = await infrai.email.event.list(input.message_id);
  return decideLearnerStatus(input, eventArray(result));
}
