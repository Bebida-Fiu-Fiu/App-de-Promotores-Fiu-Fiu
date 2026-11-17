/**
 * Cópia local (IndexedDB) do formulário de visita, para não perder o que o
 * promotor preencheu se a aba fechar ou o sinal cair.
 *
 * Dois object stores:
 * - `forms`: um registro por formulário (campos, cliente selecionado e a lista
 *   de fotos de cada galeria, só com referências).
 * - `images`: o conteúdo das fotos ainda não enviadas, uma por registro.
 *   Cada foto é gravada uma vez só; salvamentos seguintes só gravam fotos novas
 *   e apagam as que saíram do formulário.
 *
 * As fotos são guardadas como ArrayBuffer (e não Blob/File) porque versões
 * antigas do Safari no iOS falham ao guardar Blob no IndexedDB.
 */

const DEFAULT_DB_NAME = 'fiu-fiu-visit-form';
const DB_VERSION = 1;
const FORMS_STORE = 'forms';
const IMAGES_STORE = 'images';
const IMAGES_BY_FORM_INDEX = 'formKey';

/** Muda quando o formato salvo deixa de ser compatível; cópias antigas são ignoradas. */
export const VISIT_FORM_SNAPSHOT_VERSION = 1;

export type VisitFormImageInput = {
  id: string;
  /** URL de uma foto que já está no servidor; `null` para foto nova. */
  existingValue: string | null;
  /** Arquivo de uma foto ainda não enviada; `null` para foto já salva. */
  file: File | null;
};

export type VisitFormSnapshot<TValues, TClient> = {
  values: TValues;
  selectedClient: TClient | null;
  beforeImages: VisitFormImageInput[];
  afterImages: VisitFormImageInput[];
};

export type StoredVisitFormSnapshot<TValues, TClient> = VisitFormSnapshot<TValues, TClient> & {
  /** Momento do último salvamento local (ms desde epoch). */
  savedAt: number;
};

type StoredImageRef = {
  id: string;
  existingValue: string | null;
  hasFile: boolean;
};

type FormRecord = {
  key: string;
  version: number;
  savedAt: number;
  values: unknown;
  selectedClient: unknown;
  beforeImages: StoredImageRef[];
  afterImages: StoredImageRef[];
};

type ImageRecord = {
  /** `${formKey}::${imageId}`, para a mesma foto não colidir entre formulários. */
  storageId: string;
  formKey: string;
  imageId: string;
  data: ArrayBuffer;
  name: string;
  type: string;
  lastModified: number;
};

export type VisitFormStorage = {
  /** `false` quando o navegador não oferece IndexedDB (SSR, modo privado restrito...). */
  readonly isAvailable: boolean;
  save<TValues, TClient>(key: string, snapshot: VisitFormSnapshot<TValues, TClient>): Promise<void>;
  load<TValues, TClient>(key: string): Promise<StoredVisitFormSnapshot<TValues, TClient> | null>;
  clear(key: string): Promise<void>;
};

export type VisitFormStorageOptions = {
  indexedDB?: IDBFactory | null;
  dbName?: string;
  now?: () => number;
};

/**
 * Chave do formulário no aparelho. Inclui o dono (e-mail do usuário logado) para
 * que dois promotores no mesmo aparelho não vejam a visita um do outro.
 */
export function getVisitFormStorageKey(owner: string | null | undefined, visitId?: number | null) {
  const normalizedOwner = owner?.trim().toLowerCase() || 'anonimo';
  const target = typeof visitId === 'number' && Number.isFinite(visitId) ? `visit:${visitId}` : 'visit:new';

  return `${normalizedOwner}::${target}`;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Transacao do IndexedDB abortada.'));
  });
}

function getImageStorageId(formKey: string, imageId: string) {
  return `${formKey}::${imageId}`;
}

function toImageRefs(images: VisitFormImageInput[]): StoredImageRef[] {
  return images.map((image) => ({
    id: image.id,
    existingValue: image.existingValue,
    hasFile: Boolean(image.file),
  }));
}

function toLoadedImages(refs: StoredImageRef[], recordsById: Map<string, ImageRecord>): VisitFormImageInput[] {
  const images: VisitFormImageInput[] = [];

  for (const ref of refs) {
    if (!ref.hasFile) {
      if (ref.existingValue) {
        images.push({ id: ref.id, existingValue: ref.existingValue, file: null });
      }
      continue;
    }

    const record = recordsById.get(ref.id);

    // Foto sem conteúdo salvo (gravação interrompida): melhor perder a foto que quebrar a recuperação.
    if (!record) {
      continue;
    }

    images.push({
      id: ref.id,
      existingValue: ref.existingValue,
      file: new File([record.data], record.name, { type: record.type, lastModified: record.lastModified }),
    });
  }

  return images;
}

function resolveIndexedDB(option: IDBFactory | null | undefined) {
  if (option !== undefined) {
    return option;
  }

  return typeof indexedDB === 'undefined' ? null : indexedDB;
}

const unavailableStorage: VisitFormStorage = {
  isAvailable: false,
  save: async () => undefined,
  load: async () => null,
  clear: async () => undefined,
};

export function createVisitFormStorage(options: VisitFormStorageOptions = {}): VisitFormStorage {
  const factory = resolveIndexedDB(options.indexedDB);

  if (!factory) {
    return unavailableStorage;
  }

  const dbName = options.dbName ?? DEFAULT_DB_NAME;
  const now = options.now ?? Date.now;
  let dbPromise: Promise<IDBDatabase> | null = null;
  // Operações em fila: um salvamento lento nunca termina depois de um `clear` pedido depois dele.
  let queue: Promise<unknown> = Promise.resolve();

  const openDatabase = () => {
    if (!dbPromise) {
      dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = factory.open(dbName, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;

          if (!db.objectStoreNames.contains(FORMS_STORE)) {
            db.createObjectStore(FORMS_STORE, { keyPath: 'key' });
          }

          if (!db.objectStoreNames.contains(IMAGES_STORE)) {
            const imagesStore = db.createObjectStore(IMAGES_STORE, { keyPath: 'storageId' });
            imagesStore.createIndex(IMAGES_BY_FORM_INDEX, 'formKey', { unique: false });
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          // Outra aba atualizando o schema: libera a conexão e reabre na próxima operação.
          db.onversionchange = () => {
            db.close();
            dbPromise = null;
          };
          resolve(db);
        };
        request.onerror = () => {
          dbPromise = null;
          reject(request.error);
        };
        request.onblocked = () => {
          dbPromise = null;
          reject(new Error('IndexedDB bloqueado por outra aba.'));
        };
      });
    }

    return dbPromise;
  };

  const enqueue = <T>(operation: () => Promise<T>) => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  };

  const getStoredImageIds = async (db: IDBDatabase, key: string) => {
    const transaction = db.transaction(IMAGES_STORE, 'readonly');
    const done = transactionDone(transaction);
    const index = transaction.objectStore(IMAGES_STORE).index(IMAGES_BY_FORM_INDEX);
    const storageIds = (await requestToPromise(index.getAllKeys(IDBKeyRange.only(key)))) as string[];
    await done;

    return new Set(storageIds);
  };

  const save: VisitFormStorage['save'] = (key, snapshot) =>
    enqueue(async () => {
      const db = await openDatabase();
      const storedIds = await getStoredImageIds(db, key);
      const allImages = [...snapshot.beforeImages, ...snapshot.afterImages];
      const currentIds = new Set(allImages.filter((image) => image.file).map((image) => getImageStorageId(key, image.id)));

      // Lê os arquivos antes de abrir a transação de escrita: uma transação do
      // IndexedDB fecha sozinha se esperarmos uma Promise que não seja dela.
      const newImageRecords: ImageRecord[] = [];

      for (const image of allImages) {
        if (!image.file) {
          continue;
        }

        const storageId = getImageStorageId(key, image.id);

        if (storedIds.has(storageId)) {
          continue;
        }

        newImageRecords.push({
          storageId,
          formKey: key,
          imageId: image.id,
          data: await image.file.arrayBuffer(),
          name: image.file.name,
          type: image.file.type,
          lastModified: image.file.lastModified,
        });
      }

      const formRecord: FormRecord = {
        key,
        version: VISIT_FORM_SNAPSHOT_VERSION,
        savedAt: now(),
        values: snapshot.values,
        selectedClient: snapshot.selectedClient,
        beforeImages: toImageRefs(snapshot.beforeImages),
        afterImages: toImageRefs(snapshot.afterImages),
      };

      const transaction = db.transaction([FORMS_STORE, IMAGES_STORE], 'readwrite');
      const done = transactionDone(transaction);
      const imagesStore = transaction.objectStore(IMAGES_STORE);

      transaction.objectStore(FORMS_STORE).put(formRecord);
      newImageRecords.forEach((record) => imagesStore.put(record));
      storedIds.forEach((storageId) => {
        if (!currentIds.has(storageId)) {
          imagesStore.delete(storageId);
        }
      });

      await done;
    });

  const load: VisitFormStorage['load'] = <TValues, TClient>(key: string) =>
    enqueue(async () => {
      const db = await openDatabase();
      const transaction = db.transaction([FORMS_STORE, IMAGES_STORE], 'readonly');
      const done = transactionDone(transaction);
      const formRequest = requestToPromise(transaction.objectStore(FORMS_STORE).get(key));
      const imagesRequest = requestToPromise(
        transaction.objectStore(IMAGES_STORE).index(IMAGES_BY_FORM_INDEX).getAll(IDBKeyRange.only(key))
      );
      const [formRecord, imageRecords] = await Promise.all([formRequest, imagesRequest]);
      await done;

      const record = formRecord as FormRecord | undefined;

      if (!record || record.version !== VISIT_FORM_SNAPSHOT_VERSION) {
        return null;
      }

      const recordsById = new Map((imageRecords as ImageRecord[]).map((image) => [image.imageId, image]));

      return {
        savedAt: record.savedAt,
        values: record.values as TValues,
        selectedClient: (record.selectedClient ?? null) as TClient | null,
        beforeImages: toLoadedImages(record.beforeImages, recordsById),
        afterImages: toLoadedImages(record.afterImages, recordsById),
      } satisfies StoredVisitFormSnapshot<TValues, TClient>;
    });

  const clear: VisitFormStorage['clear'] = (key) =>
    enqueue(async () => {
      const db = await openDatabase();
      const transaction = db.transaction([FORMS_STORE, IMAGES_STORE], 'readwrite');
      const done = transactionDone(transaction);
      const imagesStore = transaction.objectStore(IMAGES_STORE);

      transaction.objectStore(FORMS_STORE).delete(key);
      const keysRequest = imagesStore.index(IMAGES_BY_FORM_INDEX).getAllKeys(IDBKeyRange.only(key));
      // Apaga dentro do próprio callback, com a transação ainda ativa.
      keysRequest.onsuccess = () => {
        (keysRequest.result as string[]).forEach((storageId) => imagesStore.delete(storageId));
      };

      await done;
    });

  return { isAvailable: true, save, load, clear };
}

export type DebouncedTask = {
  /** Agenda a tarefa; chamadas seguidas dentro do intervalo viram uma execução só. */
  schedule(): void;
  /** Executa já a tarefa pendente, se houver. */
  flush(): Promise<void>;
  /** Descarta a execução pendente. */
  cancel(): void;
  readonly isPending: boolean;
};

export function createDebouncedTask(task: () => Promise<void> | void, delayMs: number): DebouncedTask {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = async () => {
    timer = null;
    await task();
  };

  return {
    schedule() {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        void run();
      }, delayMs);
    },
    async flush() {
      if (!timer) {
        return;
      }

      clearTimeout(timer);
      await run();
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    get isPending() {
      return timer !== null;
    },
  };
}
