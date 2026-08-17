export const CHILD_AVATARS = ["bear", "cat", "fox", "owl", "rabbit", "star"] as const;
export const CHILD_COLORS = ["teal", "coral", "yellow", "blue", "violet", "green"] as const;

export type ChildAvatar = (typeof CHILD_AVATARS)[number];
export type ChildColor = (typeof CHILD_COLORS)[number];
