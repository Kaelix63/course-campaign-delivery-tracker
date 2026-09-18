import { buildEducatorReport, sendCourseDelivery } from "../src/course_campaign";
import { createInfraiClient } from "../src/infrai_email";

const learnerEmail = process.env.LEARNER_EMAIL;
if (!learnerEmail) throw new Error("LEARNER_EMAIL is required");

const client = createInfraiClient();
const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const delivery = await sendCourseDelivery(client, {
  campaign_id: `agent-systems-${new Date().toISOString().slice(0, 10)}`,
  course_title: "Building Reliable RAG Agents",
  learner: { email: learnerEmail, name: "Ada" },
  deadline,
});

const report = await buildEducatorReport(client, {
  message_id: delivery.message_id,
  learner_email: delivery.learner_email,
  deadline,
});

console.log(JSON.stringify({ delivery, report }, null, 2));
