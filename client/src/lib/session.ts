type AppRole = "admin" | "worker";

type StoredUser = {
  role?: string;
  name?: string;
  email?: string;
};

export const normalizeRole = (role?: string | null): AppRole | null => {
  if (!role) return null;
  if (role === "admin") return "admin";
  return "worker";
};

export const getStoredUser = (): StoredUser | null => {
  try {
    const rawUser = localStorage.getItem("CivicResource_user") || localStorage.getItem("CivicFlow_user");
    if (!rawUser) return null;
    return JSON.parse(rawUser) as StoredUser;
  } catch {
    return null;
  }
};

export const getSessionRole = (): AppRole | null => {
  return normalizeRole(getStoredUser()?.role);
};