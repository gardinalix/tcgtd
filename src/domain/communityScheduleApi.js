import { authRequest } from "./authClient";

export async function loadPublicCommunitySchedules() {
  return authRequest("/api/community/schedules");
}

export async function loadManagedCommunitySchedules() {
  return authRequest("/api/community/schedules/manage");
}

export async function createCommunitySchedule(input) {
  return authRequest("/api/community/schedules", { method: "POST", body: input });
}

export async function setCommunityScheduleActive(scheduleId, active) {
  return authRequest(`/api/community/schedules/${encodeURIComponent(scheduleId)}`, {
    method: "PATCH",
    body: { active },
  });
}

export async function createCommunityScheduleException(scheduleId, input) {
  return authRequest(`/api/community/schedules/${encodeURIComponent(scheduleId)}/exceptions`, {
    method: "POST",
    body: input,
  });
}

export async function deleteCommunityScheduleException(scheduleId, exceptionId) {
  return authRequest(`/api/community/schedules/${encodeURIComponent(scheduleId)}/exceptions/${encodeURIComponent(exceptionId)}`, {
    method: "DELETE",
  });
}
