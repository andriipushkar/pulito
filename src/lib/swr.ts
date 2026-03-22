export const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);
