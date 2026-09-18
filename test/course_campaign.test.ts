import assert from "node:assert/strict";
import test from "node:test";
import { decideLearnerStatus } from "../src/course_campaign";

test("a bounce takes priority and tells the educator to correct the address", () => {
  const report = decideLearnerStatus(
    {
      message_id: "msg_course_42",
      learner_email: "learner@example.edu",
      deadline: "2026-09-03T09:00:00.000Z",
      as_of: "2026-09-04T09:00:00.000Z",
    },
    [{ type: "opened" }, { type: "bounced" }],
  );

  assert.deepEqual(report, {
    message_id: "msg_course_42",
    learner_email: "learner@example.edu",
    deadline: "2026-09-03T09:00:00.000Z",
    status: "bounced",
    educator_action: "correct_address",
  });
});

test("an unopened delivery past its deadline asks for learner follow-up", () => {
  const report = decideLearnerStatus(
    {
      message_id: "msg_course_43",
      learner_email: "learner@example.edu",
      deadline: "2026-09-03T09:00:00.000Z",
      as_of: "2026-09-04T09:00:00.000Z",
    },
    [{ type: "delivered" }],
  );

  assert.equal(report.status, "deadline_missed");
  assert.equal(report.educator_action, "remind_learner");
});
