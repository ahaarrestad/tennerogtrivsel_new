// Auto-mock for dompurify — brukes av vi.mock('dompurify') uten factory
export default { sanitize: vi.fn((html) => html) };
