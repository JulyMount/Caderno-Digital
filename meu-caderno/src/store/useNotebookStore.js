import { create } from 'zustand';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { dexieStorage } from "../db";

const INITIAL_DATA = [];

const reorderArray = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

let unsubscribeFirestore = null;

// DEPOIS:
export const useNotebookStore = create((set, get) => {
  // Inicializa o estado com INITIAL_DATA (ou array vazio) até a leitura assíncrona do Dexie terminar
  const initialCourses = INITIAL_DATA;

  // Função para carregar os dados do Dexie logo que a aplicação inicia
  const loadInitialData = async () => {
    try {
      const user = get()?.user;
      const storageKey = user && user.email ? `user_notebook_courses_${user.email}` : 'user_notebook_courses_guest';
      
      const savedData = await dexieStorage.getItem(storageKey);
      
      // Se encontrou dados no Dexie, atualiza o estado
      if (savedData) {
        set({ courses: JSON.parse(savedData) });
      } else {
        // Migração suave: se não encontrou no Dexie mas tinha no localStorage antigo, resgata
        const oldLocalStorage = localStorage.getItem(storageKey);
        if (oldLocalStorage) {
          const parsed = JSON.parse(oldLocalStorage);
          set({ courses: parsed });
          await dexieStorage.setItem(storageKey, oldLocalStorage); // Salva no Dexie
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do Dexie:", err);
    }
  };

  // Executa o carregamento assíncrono inicial
  setTimeout(() => {
    loadInitialData();
  }, 0);

  // Função auxiliar para salvar no Dexie (IndexedDB) e no Firebase
  const persistState = async (newCourses) => {
    const user = get().user;

    // Se for usuário real com e-mail, salva com a chave dele. Se for visitante, salva na chave local 'guest'
    const storageKey = user && user.email && !user.isGuest 
      ? `user_notebook_courses_${user.email}` 
      : 'user_notebook_courses_guest';

    // 1. Salva SEMPRE no IndexedDB/Dexie do navegador local
    await dexieStorage.setItem(storageKey, JSON.stringify(newCourses));

    // 2. Salva no Firebase APENAS se tiver e-mail e NÃO for visitante
    if (user && user.email && !user.isGuest) {
      const userDocRef = doc(db, 'users', user.email, 'data', 'notebook');
      setDoc(userDocRef, { courses: newCourses }, { merge: true }).catch(err => {
        console.error("Erro ao sincronizar com Firebase:", err);
      });
    }
  };

  return {
    user: null,
    plan: 'free',
    aiUsage: {
      month: new Date().toISOString().slice(0, 7),
      summaryCount: 0,
      flashcardCount: 0,
    },
    courses: initialCourses,
    selectedCourseId: null,
    selectedSemesterId: null,
    selectedSubjectId: null,
    selectedLessonId: null,

    setUser: async (user) => {
      // Cancela qualquer escuta do Firebase anterior
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      set({ 
      user, 
      plan: user?.plan || 'free',
      aiUsage: user?.aiUsage || {
        month: new Date().toISOString().slice(0, 7),
        summaryCount: 0,
        flashcardCount: 0,
      },
      selectedCourseId: null, 
      selectedSemesterId: null, 
      selectedSubjectId: null, 
      selectedLessonId: null 
    });

      // Se for um usuário real (com e-mail e não sendo Guest)
      if (user && user.email && !user.isGuest) {
        // Tenta pegar do Dexie local
        try {
          const localCache = await dexieStorage.getItem(`user_notebook_courses_${user.email}`);
          if (localCache) set({ courses: JSON.parse(localCache) });
        } catch (err) {
          console.error("Erro ao ler do Dexie:", err);
        }

        // Conecta ao Firebase
        const userDocRef = doc(db, 'users', user.email, 'data', 'notebook');
        unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.courses) {
              set({ courses: data.courses });
              dexieStorage.setItem(`user_notebook_courses_${user.email}`, JSON.stringify(data.courses));
            }
          } else {
            setDoc(userDocRef, { courses: INITIAL_DATA });
            set({ courses: INITIAL_DATA });
            dexieStorage.setItem(`user_notebook_courses_${user.email}`, JSON.stringify(INITIAL_DATA));
          }
        });
      } else {
        // Modo VISITANTE: Lê puramente do Dexie local deste computador
        try {
          const guestCache = await dexieStorage.getItem('user_notebook_courses_guest');
          set({ courses: guestCache ? JSON.parse(guestCache) : INITIAL_DATA });
        } catch (err) {
          set({ courses: INITIAL_DATA });
        }
      }
    },

    // Checa se o usuário pode gerar conteúdo por IA
    canGenerateAiContent: (type) => {
      const { plan, aiUsage } = get();
      
      // Se for PRO, libera sem restrições
      if (plan === 'pro') return { allowed: true };

      const currentMonth = new Date().toISOString().slice(0, 7);
      
      let currentUsage = { ...aiUsage };
      if (currentUsage.month !== currentMonth) {
        currentUsage = { month: currentMonth, summaryCount: 0, flashcardCount: 0 };
      }

      // Limites do Plano FREE
      const LIMITS = {
        summary: 10,
        flashcard: 5,
      };

      const count = type === 'summary' ? (currentUsage.summaryCount || 0) : (currentUsage.flashcardCount || 0);
      const limit = LIMITS[type];

      if (count >= limit) {
        return {
          allowed: false,
          reason: `Você atingiu o limite de ${limit} ${type === 'summary' ? 'resumos' : 'flashcards'} gratuitos deste mês. Assine o Plano PRO para ter uso ilimitado!`,
        };
      }

      return { allowed: true };
    },

    // Incrementa o contador do usuário após usar a IA
    incrementAiUsage: async (type) => {
      const { aiUsage, user } = get();
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      const updatedUsage = {
        month: currentMonth,
        summaryCount: type === 'summary' ? (aiUsage.summaryCount || 0) + 1 : (aiUsage.summaryCount || 0),
        flashcardCount: type === 'flashcard' ? (aiUsage.flashcardCount || 0) + 1 : (aiUsage.flashcardCount || 0),
      };

      set({ aiUsage: updatedUsage });

      // Se estiver logado, salva também no Firestore
      if (user?.email && !user.isGuest) {
        try {
          const userRef = doc(db, 'users', user.email);
          await setDoc(userRef, { aiUsage: updatedUsage }, { merge: true });
        } catch (err) {
          console.error("Erro ao atualizar uso de IA no Firebase:", err);
        }
      }
    },

    setSelectedCourseId: (id) => set({ selectedCourseId: id, selectedSemesterId: null, selectedSubjectId: null, selectedLessonId: null }),
    setSelectedSemesterId: (id) => set({ selectedSemesterId: id, selectedSubjectId: null, selectedLessonId: null }),
    setSelectedSubjectId: (id) => set({ selectedSubjectId: id, selectedLessonId: null }),
    setSelectedLessonId: (id) => set({ selectedLessonId: id }),

    // Os métodos de CRUD continuam iguais, pois todos usam persistState(updated)
    addCourse: (name, iconKey = 'GraduationCap', color = 'from-blue-600 to-indigo-700') => {
      const newCourse = { id: Date.now().toString(), name, iconKey, color, semesters: [] };
      const updated = [...get().courses, newCourse];
      set({ courses: updated });
      persistState(updated);
    },
    editCourse: (id, name, iconKey, color) => {
      const updated = get().courses.map(c => c.id === id ? { ...c, name, iconKey: iconKey || c.iconKey, color: color || c.color } : c);
      set({ courses: updated });
      persistState(updated);
    },
    deleteCourse: (id) => {
      const updated = get().courses.filter(c => c.id !== id);
      set({ courses: updated, selectedCourseId: null });
      persistState(updated);
    },
    reorderCourses: (fromIndex, toIndex) => {
      const updated = reorderArray(get().courses, fromIndex, toIndex);
      set({ courses: updated });
      persistState(updated);
    },

    addSemester: (courseId, name) => {
      const targetCourseId = courseId || get().selectedCourseId;
      const newSem = { id: Date.now().toString(), name, subjects: [] };
      const updated = get().courses.map(c => c.id === targetCourseId ? { ...c, semesters: [...c.semesters, newSem] } : c);
      set({ courses: updated });
      persistState(updated);
    },
    editSemester: (id, name) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => s.id === id ? { ...s, name } : s)
      }));
      set({ courses: updated });
      persistState(updated);
    },
    deleteSemester: (id) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.filter(s => s.id !== id)
      }));
      set({ courses: updated });
      persistState(updated);
    },
    reorderSemesters: (fromIndex, toIndex) => {
      const { courses, selectedCourseId } = get();
      const updated = courses.map(c => {
        if (c.id === selectedCourseId) {
          return { ...c, semesters: reorderArray(c.semesters, fromIndex, toIndex) };
        }
        return c;
      });
      set({ courses: updated });
      persistState(updated);
    },

    addSubject: (semesterId, subjectData) => {
      const newSub = { id: Date.now().toString(), chapters: [], ...subjectData };
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => s.id === semesterId ? { ...s, subjects: [...s.subjects, newSub] } : s)
      }));
      set({ courses: updated });
      persistState(updated);
    },
    editSubject: (subjectId, subjectData) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? { ...sub, ...subjectData } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    deleteSubject: (subjectId) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.filter(sub => sub.id !== subjectId)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    reorderSubjects: (semesterId, fromIndex, toIndex) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => {
          if (s.id === semesterId) {
            return { ...s, subjects: reorderArray(s.subjects, fromIndex, toIndex) };
          }
          return s;
        })
      }));
      set({ courses: updated });
      persistState(updated);
    },

    addChapter: (subjectId, title) => {
      const newChap = { id: Date.now().toString(), title, lessons: [] };
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? { ...sub, chapters: [...sub.chapters, newChap] } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    editChapter: (subjectId, chapterId, title) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? {
            ...sub,
            chapters: sub.chapters.map(ch => ch.id === chapterId ? { ...ch, title } : ch)
          } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    deleteChapter: (subjectId, chapterId) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? {
            ...sub,
            chapters: sub.chapters.filter(ch => ch.id !== chapterId)
          } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    reorderChapters: (subjectId, fromIndex, toIndex) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => {
            if (sub.id === subjectId) {
              return { ...sub, chapters: reorderArray(sub.chapters, fromIndex, toIndex) };
            }
            return sub;
          })
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },

    addLesson: (subjectId, chapterId, title) => {
      const newLesson = { id: Date.now().toString(), title, date: 'Hoje', content: '' };
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? {
            ...sub,
            chapters: sub.chapters.map(ch => ch.id === chapterId ? {
              ...ch,
              lessons: [...ch.lessons, newLesson]
            } : ch)
          } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    editLesson: (subjectId, lessonId, title) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? {
            ...sub,
            chapters: sub.chapters.map(ch => ({
              ...ch,
              lessons: ch.lessons.map(l => l.id === lessonId ? { ...l, title } : l)
            }))
          } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    deleteLesson: (subjectId, lessonId) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? {
            ...sub,
            chapters: sub.chapters.map(ch => ({
              ...ch,
              lessons: ch.lessons.filter(l => l.id !== lessonId)
            }))
          } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    reorderLessons: (subjectId, chapterId, fromIndex, toIndex) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? {
            ...sub,
            chapters: sub.chapters.map(ch => {
              if (ch.id === chapterId) {
                return { ...ch, lessons: reorderArray(ch.lessons, fromIndex, toIndex) };
              }
              return ch;
            })
          } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    saveLessonContent: (subjectId, lessonId, content) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? {
            ...sub,
            chapters: sub.chapters.map(ch => ({
              ...ch,
              lessons: ch.lessons.map(l => l.id === lessonId ? { ...l, content } : l)
            }))
          } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    },
    saveLessonAICache: (subjectId, lessonId, aiCacheData) => {
      const updated = get().courses.map(c => ({
        ...c,
        semesters: c.semesters.map(s => ({
          ...s,
          subjects: s.subjects.map(sub => sub.id === subjectId ? {
            ...sub,
            chapters: sub.chapters.map(ch => ({
              ...ch,
              lessons: ch.lessons.map(l => l.id === lessonId ? { ...l, ...aiCacheData } : l)
            }))
          } : sub)
        }))
      }));
      set({ courses: updated });
      persistState(updated);
    }
  };
});