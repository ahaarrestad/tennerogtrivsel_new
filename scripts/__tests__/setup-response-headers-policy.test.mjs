import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('node:child_process');

import { execFileSync } from 'node:child_process';
import {
    FatalError,
    loadHashData,
    buildScriptSrc,
    buildCspString,
    findExistingPolicy,
    getExistingPolicyConfig,
    ensurePolicy,
} from '../setup-response-headers-policy.mjs';

describe('loadHashData', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'csp-test-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returnerer parsert hashData ved gyldig JSON-fil', () => {
        const filePath = join(tmpDir, 'csp-hashes.json');
        writeFileSync(filePath, JSON.stringify({ scriptHashes: ['sha256-abc'] }));
        const data = loadHashData(filePath);
        expect(data.scriptHashes).toEqual(['sha256-abc']);
    });

    it('kaster feil med melding om "npm run build" når filen mangler', () => {
        const filePath = join(tmpDir, 'finnes-ikke.json');
        expect(() => loadHashData(filePath)).toThrow(/npm run build/);
    });

    it('kaster feil ved ugyldig JSON', () => {
        const filePath = join(tmpDir, 'ugyldig.json');
        writeFileSync(filePath, 'ikke json {{}');
        expect(() => loadHashData(filePath)).toThrow();
    });
});

describe('buildScriptSrc', () => {
    it('kaster FatalError når scriptHashes er tom', () => {
        expect(() => buildScriptSrc([])).toThrow(FatalError);
    });

    it('kaster FatalError med melding om "npm run build"', () => {
        expect(() => buildScriptSrc([])).toThrow(/npm run build/);
    });

    it('returnerer script-src med hashes uten unsafe-inline', () => {
        const result = buildScriptSrc(['sha256-abc', 'sha256-def']);
        expect(result).toContain("'sha256-abc'");
        expect(result).toContain("'sha256-def'");
        expect(result).toContain("'self'");
        expect(result).not.toContain('unsafe-inline');
    });

    it('inkluderer Google-domener i script-src', () => {
        const result = buildScriptSrc(['sha256-abc']);
        expect(result).toContain('https://apis.google.com');
        expect(result).toContain('https://accounts.google.com');
    });
});

describe('buildCspString', () => {
    it('returnerer semikolonseparert CSP-streng', () => {
        const result = buildCspString("'self' 'sha256-abc'");
        expect(result).toContain("script-src 'self' 'sha256-abc'");
        expect(result).toContain("default-src 'self'");
    });
});

describe('findExistingPolicy', () => {
    beforeEach(() => vi.mocked(execFileSync).mockReset());

    it('returnerer ID når policy med riktig navn finnes', () => {
        vi.mocked(execFileSync).mockReturnValueOnce(JSON.stringify({
            ResponseHeadersPolicyList: {
                Items: [{
                    ResponseHeadersPolicy: {
                        Id: 'policy-id-123',
                        ResponseHeadersPolicyConfig: { Name: 'tot-security-headers' },
                    },
                }],
            },
        }));
        expect(findExistingPolicy()).toBe('policy-id-123');
    });

    it('returnerer null når ingen policy matcher', () => {
        vi.mocked(execFileSync).mockReturnValueOnce(JSON.stringify({
            ResponseHeadersPolicyList: { Items: [] },
        }));
        expect(findExistingPolicy()).toBeNull();
    });
});

describe('getExistingPolicyConfig', () => {
    beforeEach(() => vi.mocked(execFileSync).mockReset());

    it('returnerer etag og csp-streng fra AWS-svar', () => {
        vi.mocked(execFileSync).mockReturnValueOnce(JSON.stringify({
            ETag: 'etag-xyz',
            ResponseHeadersPolicy: {
                ResponseHeadersPolicyConfig: {
                    SecurityHeadersConfig: {
                        ContentSecurityPolicy: { ContentSecurityPolicy: 'csp-innhold' },
                    },
                },
            },
        }));
        const result = getExistingPolicyConfig('policy-id-123');
        expect(result.etag).toBe('etag-xyz');
        expect(result.csp).toBe('csp-innhold');
    });
});

describe('ensurePolicy — idempotens', () => {
    beforeEach(() => vi.mocked(execFileSync).mockReset());

    it('kaller update-response-headers-policy når CSP er endret', () => {
        vi.mocked(execFileSync)
            .mockReturnValueOnce(JSON.stringify({
                ResponseHeadersPolicyList: {
                    Items: [{
                        ResponseHeadersPolicy: {
                            Id: 'policy-id-123',
                            ResponseHeadersPolicyConfig: { Name: 'tot-security-headers' },
                        },
                    }],
                },
            }))
            .mockReturnValueOnce(JSON.stringify({
                ETag: 'etag-abc',
                ResponseHeadersPolicy: {
                    ResponseHeadersPolicyConfig: {
                        SecurityHeadersConfig: {
                            ContentSecurityPolicy: { ContentSecurityPolicy: 'gammel-csp' },
                        },
                    },
                },
            }))
            .mockReturnValueOnce(JSON.stringify({ ResponseHeadersPolicy: { Id: 'policy-id-123' } }));

        ensurePolicy('ny-csp-streng');

        const allArgs = vi.mocked(execFileSync).mock.calls.map(c => c[1]);
        expect(allArgs.some(args => args.includes('update-response-headers-policy'))).toBe(true);
    });

    it('hopper over update når CSP er uendret', () => {
        const sameCsp = 'uendret-csp-streng';

        vi.mocked(execFileSync)
            .mockReturnValueOnce(JSON.stringify({
                ResponseHeadersPolicyList: {
                    Items: [{
                        ResponseHeadersPolicy: {
                            Id: 'policy-id-123',
                            ResponseHeadersPolicyConfig: { Name: 'tot-security-headers' },
                        },
                    }],
                },
            }))
            .mockReturnValueOnce(JSON.stringify({
                ETag: 'etag-abc',
                ResponseHeadersPolicy: {
                    ResponseHeadersPolicyConfig: {
                        SecurityHeadersConfig: {
                            ContentSecurityPolicy: { ContentSecurityPolicy: sameCsp },
                        },
                    },
                },
            }));

        ensurePolicy(sameCsp);

        const allArgs = vi.mocked(execFileSync).mock.calls.map(c => c[1]);
        expect(allArgs.every(args => !args.includes('update-response-headers-policy'))).toBe(true);
    });

    it('kaller create-response-headers-policy når policy ikke finnes', () => {
        vi.mocked(execFileSync)
            .mockReturnValueOnce(JSON.stringify({
                ResponseHeadersPolicyList: { Items: [] },
            }))
            .mockReturnValueOnce(JSON.stringify({
                ResponseHeadersPolicy: { Id: 'ny-policy-id' },
            }));

        const id = ensurePolicy('en-csp-streng');

        const allArgs = vi.mocked(execFileSync).mock.calls.map(c => c[1]);
        expect(allArgs.some(args => args.includes('create-response-headers-policy'))).toBe(true);
        expect(id).toBe('ny-policy-id');
    });
});
