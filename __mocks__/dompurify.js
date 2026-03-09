// Auto-mock for dompurify — brukes av vi.mock('dompurify') uten factory
import { vi } from 'vitest';
export default { sanitize: vi.fn((html) => html) };
