export const getTimeBasedGreeting = (userName = "") => {
  const hour = new Date().getHours();
  const firstName = userName ? userName.split(" ")[0] : "Trader";

  let greeting = "";
  let emoji = "";

  if (hour < 5) {
    greeting = "Night Owl";
    emoji = "🌙";
  } else if (hour < 12) {
    greeting = "Good Morning";
    emoji = "☀️";
  } else if (hour < 17) {
    greeting = "Good Afternoon";
    emoji = "🌤️";
  } else if (hour < 21) {
    greeting = "Good Evening";
    emoji = "🌅";
  } else {
    greeting = "Night Trading";
    emoji = "🌙";
  }

  return {
    greeting,
    emoji,
    fullGreeting: `${emoji} ${greeting}, ${firstName}`,
  };
};

export const getUserLevelBadge = (user) => {
  if (!user)
    return { level: "User", color: "#A1A1A6", bg: "rgba(161,161,166,0.15)" };

  if (user.role === "admin") {
    return { level: "⭐ Admin", color: "#FFD60A", bg: "rgba(255,214,10,0.15)" };
  }

  if (user.status === "ACTIVE") {
    const hasActiveTrading =
      user.journal && Object.keys(user.journal || {}).length >= 10;
    if (hasActiveTrading) {
      return {
        level: "💎 Elite",
        color: "#30B0C0",
        bg: "rgba(48,176,192,0.15)",
      };
    }
    return { level: "⬆️ Pro", color: "#30D158", bg: "rgba(48,209,88,0.15)" };
  }

  if (user.status === "PENDING") {
    return {
      level: "🔄 Pending",
      color: "#FFD60A",
      bg: "rgba(255,214,10,0.15)",
    };
  }

  if (user.status === "BLOCKED") {
    return {
      level: "⛔ Blocked",
      color: "#FF453A",
      bg: "rgba(255,69,58,0.15)",
    };
  }

  return { level: "Member", color: "#0A84FF", bg: "rgba(10,132,255,0.15)" };
};

export const cacheUserList = (users) => {
  try {
    const cacheData = {
      users,
      timestamp: Date.now(),
      version: 1,
    };
    localStorage.setItem("TradersApp_UserListCache", JSON.stringify(cacheData));
    return true;
  } catch (error) {
    console.warn("Failed to cache user list:", error);
    return false;
  }
};

export const getCachedUserList = (maxAgeMs = 5 * 60 * 1000) => {
  try {
    const cached = localStorage.getItem("TradersApp_UserListCache");
    if (!cached) return null;

    const cacheData = JSON.parse(cached);

    if (Date.now() - cacheData.timestamp > maxAgeMs) {
      localStorage.removeItem("TradersApp_UserListCache");
      return null;
    }

    if (
      cacheData.version !== 1 ||
      !cacheData.users ||
      typeof cacheData.users !== "object"
    ) {
      localStorage.removeItem("TradersApp_UserListCache");
      return null;
    }

    return cacheData.users;
  } catch (error) {
    console.warn("Failed to retrieve cached user list:", error);
    return null;
  }
};

export const clearUserListCache = () => {
  try {
    localStorage.removeItem("TradersApp_UserListCache");
    return true;
  } catch (error) {
    console.warn("Failed to clear user list cache:", error);
    return false;
  }
};

export const getUserListCacheMetadata = () => {
  try {
    const cached = localStorage.getItem("TradersApp_UserListCache");
    if (!cached) {
      return {
        exists: false,
        size: 0,
        age: null,
        isExpired: true,
        userCount: 0,
      };
    }

    const cacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;
    const maxAge = 5 * 60 * 1000;
    const isExpired = age > maxAge;

    return {
      exists: true,
      size: cached.length,
      age,
      isExpired,
      userCount: Object.keys(cacheData.users || {}).length,
      createdAt: new Date(cacheData.timestamp).toLocaleString(),
    };
  } catch (error) {
    console.warn("Failed to get cache metadata:", error);
    return { exists: false, size: 0, age: null, isExpired: true, userCount: 0 };
  }
};
