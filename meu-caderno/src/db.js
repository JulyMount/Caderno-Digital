import Dexie from 'dexie';

// Cria a instância do banco de dados no navegador
export const db = new Dexie('CadernoDigitalDB');

// Define a estrutura da tabela
// Definimos o campo 'key' como chave primária para integrar perfeitamente com o Zustand
db.version(1).stores({
  appState: 'key' 
});

// Adapter para conectar o IndexedDB ao middleware persist do Zustand
export const dexieStorage = {
  getItem: async (name) => {
    const item = await db.appState.get(name);
    return item ? item.value : null;
  },
  setItem: async (name, value) => {
    await db.appState.put({ key: name, value });
  },
  removeItem: async (name) => {
    await db.appState.delete(name);
  },
};