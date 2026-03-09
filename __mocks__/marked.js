// Auto-mock for marked — brukes av vi.mock('marked') uten factory
export const marked = { parse: vi.fn((text) => `<p>${text}</p>`) };
