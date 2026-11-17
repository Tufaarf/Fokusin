import type { Project, Task } from "../types";
import type { User } from "../store";

/**
 * Filter tasks to only include tasks that:
 * 1. Belong to one of the user's projects (projects where the user is creator or member)
 * 2. OR are directly assigned to the current user (assignee matches name or email)
 *
 * Superadmin can see all tasks across the workspace.
 * In guest/demo mode (currentUser is null), tasks assigned to 'You' or in initial projects are included.
 */
export function filterUserTasks(
  tasks: Task[],
  projects: Project[],
  currentUser: User | null,
): Task[] {
  if (!tasks || !Array.isArray(tasks)) {
    return [];
  }

  // Superadmin can see all tasks
  if (currentUser?.role === "superadmin" || currentUser?.is_superadmin) {
    return tasks;
  }

  const projectIds = new Set((projects || []).map((p) => p.id));
  const currentUserName = currentUser?.name?.trim().toLowerCase();
  const currentUserEmail = currentUser?.email?.trim().toLowerCase();

  return tasks.filter((task) => {
    // 1. Task yang berada di project kita
    if (task.projectId && projectIds.has(task.projectId)) {
      return true;
    }

    // 2. Task milik kita (assignee adalah user yang sedang login)
    if (task.assignee) {
      const assigneeLower = task.assignee.trim().toLowerCase();
      if (currentUserName && assigneeLower === currentUserName) {
        return true;
      }
      if (currentUserEmail && assigneeLower === currentUserEmail) {
        return true;
      }
      // Demo / offline mode tanpa login: task milik 'You'
      if (!currentUser && (assigneeLower === "you" || assigneeLower.includes("you"))) {
        return true;
      }
    }

    return false;
  });
}
