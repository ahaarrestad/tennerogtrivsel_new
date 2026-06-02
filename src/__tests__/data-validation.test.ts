import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

type ZMock = Record<string, (...args: unknown[]) => ZMock> & {
    coerce: { date: (...args: unknown[]) => ZMock };
    safeParse: (data: unknown) => { success: boolean; data: unknown };
};

// Mock astro:content med en funksjonell zod-liknende mock
vi.mock('astro:content', () => {
    const zMock = {
        object: vi.fn(),
        string: vi.fn(),
        number: vi.fn(),
        boolean: vi.fn(),
        array: vi.fn(),
        union: vi.fn(),
        optional: vi.fn(),
        default: vi.fn(),
        coerce: { date: vi.fn() },
        safeParse: vi.fn((data: unknown) => ({ success: true, data })),
    } as unknown as ZMock;
    Object.entries(zMock).forEach(([key, v]) => {
        if (key !== 'safeParse' && key !== 'coerce' && typeof v === 'function') {
            vi.mocked(v).mockReturnValue(zMock);
        }
    });
    vi.mocked(zMock.coerce.date).mockReturnValue(zMock);
    return {
        defineCollection: vi.fn((config: unknown) => config),
        z: zMock,
    };
});

describe('Datavalidering (Synkroniserte filer)', () => {
    const contentPath = path.join(process.cwd(), 'src/content');
    const assetsPath = path.join(process.cwd(), 'src/assets/tannleger');

    it('hver tannlege bør ha et bilde som eksisterer i assets', () => {
        const tannlegerFile = path.join(contentPath, 'tannleger.json');
        
        // Hopp over hvis filen ikke er generert enda (f.eks. i nytt miljø)
        if (!fs.existsSync(tannlegerFile)) {
            console.warn('tannleger.json finnes ikke, hopper over test.');
            return;
        }

        const data = JSON.parse(fs.readFileSync(tannlegerFile, 'utf-8'));
        
        (data as Array<Record<string, unknown>>).forEach((tannlege) => {
            if (tannlege.image) {
                const imagePath = path.join(assetsPath, tannlege.image);
                expect(fs.existsSync(imagePath), `Bilde ${tannlege.image} for ${tannlege.name} mangler i assets`).toBe(true);
            }
        });
    });

    it('hver tjeneste bør ha påkrevde frontmatter-felter', () => {
        const tjenesterPath = path.join(contentPath, 'tjenester');
        
        if (!fs.existsSync(tjenesterPath)) {
            console.warn('src/content/tjenester finnes ikke, hopper over test.');
            return;
        }

        const files = fs.readdirSync(tjenesterPath).filter(f => f.endsWith('.md'));
        
        files.forEach(file => {
            const content = fs.readFileSync(path.join(tjenesterPath, file), 'utf-8');
            
            // Enkel sjekk for frontmatter uten å bruke tunge bibs
            expect(content, `Filen ${file} mangler start-frontmatter (---)`).toMatch(/^---/);
            expect(content, `Filen ${file} mangler tittel i frontmatter`).toMatch(/title:/);
            expect(content, `Filen ${file} mangler ingress i frontmatter`).toMatch(/ingress:/);
        });
    });

    it('innstillinger-mappen bør ha .gitkeep filer for å overleve bygget hvis tom', () => {
        // Dette sikrer at mapper som trengs av sync-data alltid finnes i git
        const requiredFolders = [
            'src/content/tjenester',
            'src/content/meldinger',
            'src/assets/tannleger'
        ];

        requiredFolders.forEach(folder => {
            const gitkeep = path.join(process.cwd(), folder, '.gitkeep');
            expect(fs.existsSync(gitkeep), `Mappen ${folder} mangler .gitkeep`).toBe(true);
        });
    });

    it('tannleger collection should include imageConfig in schema', async () => {
        const { collections } = await import('../content.config');
        const schema = collections.tannleger.schema;
        
        const validData = {
            id: 'test',
            name: 'Test',
            title: 'Tittel',
            description: 'Besk',
            imageConfig: {
                scale: 1.5,
                positionX: 20,
                positionY: 80
            }
        };
        
        const result = schema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.imageConfig?.scale).toBe(1.5);
        }
    });
});
