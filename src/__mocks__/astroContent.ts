// src/__mocks__/astroContent.ts
// This file mocks 'astro:content' to allow testing components/scripts
// that import getCollection from it.

export const getCollection = async (collectionName: string) => {
  // This is a placeholder mock.
  // In your actual tests, you'll want to use `vi.mock`
  // from Vitest to control the return value of getCollection
  // based on the specific test case.
  console.warn(`Mocked getCollection called for: ${collectionName}.
  Remember to use vi.mock('astro:content') in your tests to provide
  specific mock data.`);
  return [];
};

// You might need to export other things from 'astro:content' if your
// code uses them, e.g., getEntry, CollectionEntry, etc.
