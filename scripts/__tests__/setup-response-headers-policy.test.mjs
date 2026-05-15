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
    checkAccount,
    findExistingPolicy,
    getExistingPolicyConfig,
    ensurePolicy,
} from '../setup-response-headers-policy.mjs';

// Hjelpefunksjon for å lage et feil-objekt som ligner på det execFileSync kaster
function makeExecError({ message = 'AWS error', stderr = '', stdout = '', signal = null, status = 1 } = {}) {
    return Object.assign(new Error(message), { stderr, stdout, signal, status });
}

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

    it('kaster FatalError med melding om "npm run build" når filen mangler', () => {
        const filePath = join(tmpDir, 'finnes-ikke.json');
        expect(() => loadHashData(filePath)).toThrow(FatalError);
    });

    it('ENOENT-meldingen inneholder filbanen og "npm run build"', () => {
        const filePath = join(tmpDir, 'finnes-ikke.json');
        expect(() => loadHashData(filePath)).toThrow(/npm run build/);
        expect(() => loadHashData(filePath)).toThrow(filePath);
    });

    it('kaster FatalError ved ugyldig JSON', () => {
        const filePath = join(tmpDir, 'ugyldig.json');
        writeFileSync(filePath, 'ikke json {{}');
        expect(() => loadHashData(filePath)).toThrow(FatalError);
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
    it('returnerer semikolon-separert CSP-streng', () => {
        const result = buildCspString("'self' 'sha256-abc'");
        expect(result).toContain("script-src 'self' 'sha256-abc'");
        expect(result).toContain("default-src 'self'");
    });

    it('inneholder alle forventede CSP-direktiver i korrekt rekkefølge', () => {
        const scriptSrc = "'self' 'sha256-abc'";
        const result = buildCspString(scriptSrc);
        expect(result).toBe(
            "default-src 'self'; " +
            `script-src ${scriptSrc}; ` +
            "style-src 'self' 'unsafe-inline'; " +
            "font-src 'self'; " +
            "img-src 'self' data: blob: https://lh3.googleusercontent.com https://drive.google.com https://www.google.com; " +
            "frame-src https://drive.google.com https://accounts.google.com https://www.google.com https://*.googleapis.com; " +
            "connect-src 'self' blob: https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://apis.google.com https://www.google.com"
        );
    });
});

describe('checkAccount', () => {
    const EXPECTED_ACCOUNT = '382286755083';
    beforeEach(() => vi.mocked(execFileSync).mockReset());

    it('logger bekreftelse ved korrekt AWS-konto', () => {
        vi.mocked(execFileSync).mockReturnValueOnce(JSON.stringify({ Account: EXPECTED_ACCOUNT }));
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        try {
            expect(() => checkAccount()).not.toThrow();
        } finally {
            consoleSpy.mockRestore();
        }
    });

    it('kaster FatalError ved feil AWS-konto', () => {
        vi.mocked(execFileSync).mockReturnValueOnce(JSON.stringify({ Account: '999999999999' }));
        let caught;
        try { checkAccount(); } catch (e) { caught = e; }
        expect(caught).toBeInstanceOf(FatalError);
        expect(caught?.message).toMatch(/Feil AWS-konto/);
    });

    it('kaster FatalError med stderr-detalj når AWS-kallet feiler', () => {
        vi.mocked(execFileSync).mockImplementationOnce(() => {
            throw makeExecError({ stderr: 'NoCredentialsError', status: 1 });
        });
        let caught;
        try { checkAccount(); } catch (e) { caught = e; }
        expect(caught).toBeInstanceOf(FatalError);
        expect(caught?.message).toMatch(/NoCredentialsError/);
    });

    it('kaster FatalError med fallback-tekst når stderr mangler', () => {
        vi.mocked(execFileSync).mockImplementationOnce(() => {
            throw makeExecError({ stderr: null, stdout: null, status: 1 });
        });
        let caught;
        try { checkAccount(); } catch (e) { caught = e; }
        expect(caught).toBeInstanceOf(FatalError);
        expect(caught?.message).toMatch(/sjekk AWS_PROFILE/);
    });

    it('kaster FatalError ved ugyldig JSON-svar fra STS', () => {
        vi.mocked(execFileSync).mockReturnValueOnce('ikke json');
        let caught;
        try { checkAccount(); } catch (e) { caught = e; }
        expect(caught).toBeInstanceOf(FatalError);
        expect(caught?.message).toMatch(/JSON-svar/);
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

    it('returnerer null når ResponseHeadersPolicyList mangler i svaret', () => {
        vi.mocked(execFileSync).mockReturnValueOnce(JSON.stringify({}));
        expect(findExistingPolicy()).toBeNull();
    });

    it('kaster FatalError når AWS-kallet feiler', () => {
        vi.mocked(execFileSync).mockImplementationOnce(() => {
            throw makeExecError({ stderr: 'Access denied', status: 1 });
        });
        expect(() => findExistingPolicy()).toThrow(FatalError);
    });

    it('inkluderer stderr-innhold i feilmeldingen', () => {
        vi.mocked(execFileSync).mockImplementationOnce(() => {
            throw makeExecError({ stderr: 'Access denied', status: 1 });
        });
        expect(() => findExistingPolicy()).toThrow(/Access denied/);
    });

    it('bruker signal i feilmelding når prosessen avbrytes med signal', () => {
        vi.mocked(execFileSync).mockImplementationOnce(() => {
            throw makeExecError({ signal: 'SIGKILL', status: null });
        });
        expect(() => findExistingPolicy()).toThrow(/signal=SIGKILL/);
    });

    it('bruker fallback-tekst i feilmelding ved manglende stderr og stdout', () => {
        vi.mocked(execFileSync).mockImplementationOnce(() => {
            throw makeExecError({ stderr: null, stdout: null, status: undefined });
        });
        expect(() => findExistingPolicy()).toThrow(/ingen output/);
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

    it('kaster FatalError når AWS-kallet feiler', () => {
        vi.mocked(execFileSync).mockImplementationOnce(() => {
            throw makeExecError({ stderr: 'NoSuchEntity', status: 1 });
        });
        expect(() => getExistingPolicyConfig('ukjent-id')).toThrow(FatalError);
    });

    it('inkluderer stderr-innhold i feilmeldingen', () => {
        vi.mocked(execFileSync).mockImplementationOnce(() => {
            throw makeExecError({ stderr: 'NoSuchEntity', status: 1 });
        });
        expect(() => getExistingPolicyConfig('ukjent-id')).toThrow(/NoSuchEntity/);
    });

    it('bruker fallback-tekst ved manglende stderr og stdout', () => {
        vi.mocked(execFileSync).mockImplementationOnce(() => {
            throw makeExecError({ stderr: null, stdout: null, status: 1 });
        });
        expect(() => getExistingPolicyConfig('ukjent-id')).toThrow(/ingen output/);
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

    it('kaster FatalError når create-response-headers-policy feiler', () => {
        vi.mocked(execFileSync)
            .mockReturnValueOnce(JSON.stringify({
                ResponseHeadersPolicyList: { Items: [] },
            }))
            .mockImplementationOnce(() => {
                throw makeExecError({ stderr: 'PolicyAlreadyExists', status: 1 });
            });
        expect(() => ensurePolicy('en-csp-streng')).toThrow(FatalError);
    });

    it('bruker fallback-tekst i feilmelding ved create uten stderr og stdout', () => {
        vi.mocked(execFileSync)
            .mockReturnValueOnce(JSON.stringify({
                ResponseHeadersPolicyList: { Items: [] },
            }))
            .mockImplementationOnce(() => {
                throw makeExecError({ stderr: null, stdout: null, status: 1 });
            });
        expect(() => ensurePolicy('en-csp-streng')).toThrow(/ingen output/);
    });

    it('kaster FatalError når update-response-headers-policy feiler', () => {
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
            .mockImplementationOnce(() => {
                throw makeExecError({ stderr: 'PreconditionFailed', status: 412 });
            });
        expect(() => ensurePolicy('ny-csp-streng')).toThrow(FatalError);
    });
});
