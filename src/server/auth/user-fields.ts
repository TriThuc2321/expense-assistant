export const USER_ADDITIONAL_FIELDS = {
  role: {
    type: 'string',
    required: true,
    defaultValue: 'user',
    input: false,
  },
  blockedAt: { type: 'date', required: false, input: false },
} as const;
