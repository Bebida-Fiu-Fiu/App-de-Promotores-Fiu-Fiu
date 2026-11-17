import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDebouncedTask,
  createVisitFormStorage,
  getVisitFormStorageKey,
  type VisitFormImageInput,
  type VisitFormSnapshot,
} from '@/lib/visit-form-storage';

type Values = {
  establishmentId: string | null;
  visitDate: string;
  observation: string;
  products: Array<{ name: string; quantity: number; unit: string; expirationDate: string }>;
};

type Client = { id: string; client_name: string };

const KEY = getVisitFormStorageKey('ana@teste.local');

function makeFile(content: string, name = 'foto.jpg', type = 'image/jpeg') {
  return new File([content], name, { type, lastModified: 1_700_000_000_000 });
}

function newImage(id: string, content: string): VisitFormImageInput {
  return { id, existingValue: null, file: makeFile(content, `${id}.jpg`) };
}

function savedImage(id: string, url: string): VisitFormImageInput {
  return { id, existingValue: url, file: null };
}

function makeSnapshot(overrides: Partial<VisitFormSnapshot<Values, Client>> = {}): VisitFormSnapshot<Values, Client> {
  return {
    values: {
      establishmentId: '42',
      visitDate: '17/11/2026',
      observation: 'Gondola reorganizada',
      products: [{ name: 'ICE Cajalemon', quantity: 3, unit: 'pack', expirationDate: '10/05/2027' }],
    },
    selectedClient: { id: '42', client_name: 'Mercado Teste' },
    beforeImages: [],
    afterImages: [],
    ...overrides,
  };
}

function setup(now = () => 1_763_380_800_000) {
  const factory = new IDBFactory();
  const storage = createVisitFormStorage({ indexedDB: factory, now });

  return { factory, storage };
}

async function countImageRecords(factory: IDBFactory) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('fiu-fiu-visit-form');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const count = await new Promise<number>((resolve, reject) => {
    const request = db.transaction('images', 'readonly').objectStore('images').count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();

  return count;
}

describe('getVisitFormStorageKey', () => {
  it('separa visita nova e edição, por usuário', () => {
    expect(getVisitFormStorageKey('Ana@Teste.local')).toBe('ana@teste.local::visit:new');
    expect(getVisitFormStorageKey('ana@teste.local', 7)).toBe('ana@teste.local::visit:7');
    expect(getVisitFormStorageKey(null, 7)).toBe('anonimo::visit:7');
    expect(getVisitFormStorageKey('ana@teste.local', Number.NaN)).toBe('ana@teste.local::visit:new');
  });
});

describe('createVisitFormStorage', () => {
  it('devolve null quando não há nada salvo', async () => {
    const { storage } = setup();

    await expect(storage.load(KEY)).resolves.toBeNull();
  });

  it('salva e recupera campos, cliente e data do salvamento', async () => {
    const { storage } = setup();
    const snapshot = makeSnapshot();

    await storage.save(KEY, snapshot);
    const loaded = await storage.load<Values, Client>(KEY);

    expect(loaded).toEqual({ ...snapshot, savedAt: 1_763_380_800_000 });
  });

  it('recupera as fotos não enviadas com conteúdo, nome e tipo, na ordem certa', async () => {
    const { storage } = setup();
    const before = [newImage('a', 'conteudo-a'), savedImage('b', 'https://cdn.teste/b.jpg'), newImage('c', 'conteudo-c')];
    const after = [newImage('d', 'conteudo-d')];

    await storage.save(KEY, makeSnapshot({ beforeImages: before, afterImages: after }));
    const loaded = await storage.load<Values, Client>(KEY);

    expect(loaded?.beforeImages.map((image) => image.id)).toEqual(['a', 'b', 'c']);
    expect(loaded?.beforeImages[1]).toEqual({ id: 'b', existingValue: 'https://cdn.teste/b.jpg', file: null });

    const restoredFile = loaded?.beforeImages[0].file;
    expect(restoredFile).toBeInstanceOf(File);
    expect(restoredFile?.name).toBe('a.jpg');
    expect(restoredFile?.type).toBe('image/jpeg');
    expect(restoredFile?.lastModified).toBe(1_700_000_000_000);
    expect(await restoredFile?.text()).toBe('conteudo-a');
    expect(await loaded?.afterImages[0].file?.text()).toBe('conteudo-d');
  });

  it('não regrava fotos que já estão salvas', async () => {
    const { storage } = setup();
    const image = newImage('a', 'conteudo-a');
    const readSpy = vi.spyOn(image.file as File, 'arrayBuffer');

    await storage.save(KEY, makeSnapshot({ beforeImages: [image] }));
    await storage.save(KEY, makeSnapshot({ beforeImages: [image], values: { ...makeSnapshot().values, observation: 'nova' } }));

    expect(readSpy).toHaveBeenCalledTimes(1);
    expect((await storage.load<Values, Client>(KEY))?.values.observation).toBe('nova');
  });

  it('apaga do aparelho a foto removida do formulário', async () => {
    const { factory, storage } = setup();
    const first = newImage('a', 'conteudo-a');
    const second = newImage('b', 'conteudo-b');

    await storage.save(KEY, makeSnapshot({ beforeImages: [first, second] }));
    expect(await countImageRecords(factory)).toBe(2);

    await storage.save(KEY, makeSnapshot({ beforeImages: [second] }));

    expect(await countImageRecords(factory)).toBe(1);
    expect((await storage.load<Values, Client>(KEY))?.beforeImages.map((image) => image.id)).toEqual(['b']);
  });

  it('mantém formulários de chaves diferentes separados', async () => {
    const { storage } = setup();
    const otherKey = getVisitFormStorageKey('ana@teste.local', 7);

    await storage.save(KEY, makeSnapshot({ beforeImages: [newImage('a', 'nova-visita')] }));
    await storage.save(otherKey, makeSnapshot({ beforeImages: [newImage('a', 'edicao')] }));
    await storage.clear(KEY);

    expect(await storage.load(KEY)).toBeNull();
    const other = await storage.load<Values, Client>(otherKey);
    expect(await other?.beforeImages[0].file?.text()).toBe('edicao');
  });

  it('clear apaga o formulário e todas as fotos dele', async () => {
    const { factory, storage } = setup();

    await storage.save(KEY, makeSnapshot({ beforeImages: [newImage('a', 'x')], afterImages: [newImage('b', 'y')] }));
    await storage.clear(KEY);

    expect(await storage.load(KEY)).toBeNull();
    expect(await countImageRecords(factory)).toBe(0);
  });

  it('um clear pedido depois de um save sempre vence, mesmo sem esperar o save', async () => {
    const { storage } = setup();

    const pendingSave = storage.save(KEY, makeSnapshot({ beforeImages: [newImage('a', 'x')] }));
    const pendingClear = storage.clear(KEY);
    await Promise.all([pendingSave, pendingClear]);

    expect(await storage.load(KEY)).toBeNull();
  });

  it('ignora foto cujo conteúdo não foi gravado, sem perder o resto', async () => {
    const { factory, storage } = setup();

    await storage.save(KEY, makeSnapshot({ beforeImages: [newImage('a', 'x'), newImage('b', 'y')] }));

    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open('fiu-fiu-visit-form');
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.objectStore('images').delete(`${KEY}::a`);
      transaction.oncomplete = () => resolve();
    });
    db.close();

    const loaded = await storage.load<Values, Client>(KEY);
    expect(loaded?.beforeImages.map((image) => image.id)).toEqual(['b']);
    expect(loaded?.values.observation).toBe('Gondola reorganizada');
  });

  it('sem IndexedDB, não salva nem quebra', async () => {
    const storage = createVisitFormStorage({ indexedDB: null });

    expect(storage.isAvailable).toBe(false);
    await expect(storage.save(KEY, makeSnapshot())).resolves.toBeUndefined();
    await expect(storage.load(KEY)).resolves.toBeNull();
    await expect(storage.clear(KEY)).resolves.toBeUndefined();
  });

  it('ignora cópia salva em formato antigo', async () => {
    const { factory, storage } = setup();

    await storage.save(KEY, makeSnapshot());

    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open('fiu-fiu-visit-form');
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const transaction = db.transaction('forms', 'readwrite');
      const store = transaction.objectStore('forms');
      const request = store.get(KEY);
      request.onsuccess = () => store.put({ ...request.result, version: 0 });
      transaction.oncomplete = () => resolve();
    });
    db.close();

    await expect(storage.load(KEY)).resolves.toBeNull();
  });
});

describe('createDebouncedTask', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('junta chamadas seguidas em uma execução só, depois do intervalo', async () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 800);

    debounced.schedule();
    await vi.advanceTimersByTimeAsync(500);
    debounced.schedule();
    await vi.advanceTimersByTimeAsync(500);

    expect(task).not.toHaveBeenCalled();
    expect(debounced.isPending).toBe(true);

    await vi.advanceTimersByTimeAsync(300);

    expect(task).toHaveBeenCalledTimes(1);
    expect(debounced.isPending).toBe(false);
  });

  it('flush executa na hora a tarefa pendente, e não faz nada sem pendência', async () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 800);

    await debounced.flush();
    expect(task).not.toHaveBeenCalled();

    debounced.schedule();
    await debounced.flush();
    expect(task).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('cancel descarta a execução pendente', async () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 800);

    debounced.schedule();
    debounced.cancel();
    await vi.advanceTimersByTimeAsync(1000);

    expect(task).not.toHaveBeenCalled();
    expect(debounced.isPending).toBe(false);
  });
});
