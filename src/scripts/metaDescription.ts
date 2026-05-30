export function stripMarkdown(text: string): string {
    if (!text) return '';
    return text
        .replace(/<!--stackedit_data:[\s\S]*?-->/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

export function truncateDescription(text: string, maxLen = 155): string {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    const truncated = text.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    const cutPoint = lastSpace > 0 ? lastSpace : maxLen;
    return text.slice(0, cutPoint).trimEnd() + '…';
}
