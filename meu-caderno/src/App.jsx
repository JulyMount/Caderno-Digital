import React, { useState, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import confetti from 'canvas-confetti';
//import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
//import { jwtDecode } from 'jwt-decode';
import html2pdf from 'html2pdf.js';
import { generateSummary, generateFlashcards, improveFormatting } from './services/gemini';
import { 
  BookOpen, Plus, FileText, ArrowLeft,
  Pill, Activity, Stethoscope, Baby, Microscope, LogIn, LogOut, GraduationCap, Calendar,
  Brain, Heart, Eye, Bone, Dna, Thermometer, Syringe, FlaskConical, Calculator, Languages, Laptop,
  X, MoreVertical, Edit3, Trash2, Search, Download, GripVertical, Filter, User,
  Sparkles, HelpCircle, CheckCircle
} from 'lucide-react';

import { useNotebookStore } from './store/useNotebookStore';
import LessonEditor from './Editor';

import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

import FlashcardModal from './FlashcardModal';

import SummaryModal from './SummaryModal';

useEffect(() => {
  const queryParams = new URLSearchParams(window.location.search);
  const status = queryParams.get('status');

  if (status === 'success') {
    toast.success('🎉 Pagamento aprovado! Seu acesso Pro foi liberado.');
    // Limpa o parâmetro da URL para não reenviar o toast no refresh
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (status === 'failure') {
    toast.error('O pagamento não foi concluído. Tente novamente.');
  }
}, []);

// 🔑 GOOGLE CLIENT ID
//const GOOGLE_CLIENT_ID = "690818417195-c7an4mk5p00agpgd0netav9e9mavh2dc.apps.googleusercontent.com";

// MAPA COMPLETO DE ÍCONES
const ICON_MAP = {
  Stethoscope, GraduationCap, Pill, Activity, Baby, Microscope, Brain, Heart, Eye,
  Bone, Dna, Thermometer, Syringe, BookOpen, FlaskConical, Calculator, Languages, Laptop
};

// OPÇÕES DE CORES EM GRADIENTE
const COLOR_OPTIONS = [
  { name: 'Azul Real', value: 'from-blue-600 to-indigo-700' },
  { name: 'Âmbar', value: 'from-amber-500 to-orange-600' },
  { name: 'Verde', value: 'from-emerald-500 to-teal-600' },
  { name: 'Rosa', value: 'from-rose-500 to-pink-600' },
  { name: 'Roxo', value: 'from-purple-500 to-violet-600' },
  { name: 'Ciano', value: 'from-cyan-500 to-blue-600' }
];

export default function App() {
  // Estado para controlar o carregamento da IA
const [isAiLoading, setIsAiLoading] = useState(false);

// Função para pegar todo o texto da aula atual no editor
const getEditorText = () => {
  const editorEl = document.querySelector('.bn-editor') || document.querySelector('.blocknote-editor');
  return editorEl ? editorEl.innerText : '';
};

const [isSummaryOpen, setIsSummaryOpen] = useState(false);
const [summaryResult, setSummaryResult] = useState('');

// 1. Gerar Resumo
const handleGenerateSummary = async () => {
  // 1. CHECAGEM DE SEGURANÇA
  if (!currentLesson?.content || currentLesson.content.trim() === '') {
    toast.error('Escreva algum texto na aula antes de gerar o resumo.');
    return;
  }

  // 🟢 2. CHECAGEM DE CACHE (A mágica acontece aqui)
  // Se a aula atual já tem um resumo salvo na store/banco, abre direto!
  if (currentLesson.summary) {
    toast.info('Carregando resumo salvo...');
    setSummaryResult(currentLesson.summary);
    setIsSummaryOpen(true);
    return; // Interrompe para NÃO chamar o Gemini de novo
  }

  // 3. VERIFICA COTA DA IA
  if (!canGenerateAiContent()) {
    toast.error('Você atingiu o limite mensal de geração da IA.');
    return;
  }

  // 🟡 4. TOAST DE CARREGAMENTO (Sonner)
  const toastId = toast.loading('A IA está analisando sua aula e criando o resumo...');

  try {
    // Chamada da API do Gemini
    const text = await generateSummary(currentLesson.content);

    // 🟢 5. SALVAR NO CACHE / BANCO
    // Atualiza a aula na store salvando o resumo nela
    saveLessonAICache(selectedSubjectId, selectedLessonId, { summary: text });
    incrementAiUsage();

    setSummaryResult(text);
    setIsSummaryOpen(true);

    // 🟢 6. TOAST DE SUCESSO
    toast.success('Resumo gerado com sucesso!', { id: toastId });
  } catch (err) {
    console.error("Erro ao gerar resumo:", err);
    // 🔴 7. TOAST DE ERRO
    toast.error('Erro ao conectar com a IA. Tente novamente.', { id: toastId });
  }
};

  // 2. Inserir o Resumo no final da aula
  const handleInsertSummaryToNote = (summary) => {
    // Monta o cabeçalho e o conteúdo em Markdown
    const formattedSummary = `---\n### 📝 Resumo da Aula (IA)\n${summary}`;

    // Usa a API do BlockNote para inserir os blocos convertidos
    if (typeof window.insertSummaryToEditor === 'function') {
      window.insertSummaryToEditor(formattedSummary);
      setIsSummaryOpen(false);
      toast.success("Resumo inserido no final da aula!");
    } else {
      toast.error("O editor não está pronto para receber o texto.");
    }
  };

const [flashcards, setFlashcards] = useState([]);
const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);

// --- FUNÇÃO DE GERAR FLASHCARDS ---
const handleGenerateFlashcards = async () => {
  if (!currentLesson?.content || currentLesson.content.trim() === '') {
    toast.error('Escreva algum texto na aula para gerar flashcards.');
    return;
  }

  // 🟢 1. CHECAGEM DE CACHE
  // Se já existirem flashcards salvos para esta aula, abre direto
  if (currentLesson.flashcards && currentLesson.flashcards.length > 0) {
    toast.info('Carregando flashcards salvos...');
    setFlashcards(currentLesson.flashcards);
    setIsFlashcardModalOpen(true);
    return; // Não chama a IA novamente
  }

  if (!canGenerateAiContent()) {
    toast.error('Você atingiu o limite mensal de geração da IA.');
    return;
  }

  // 🟡 2. TOAST DE CARREGAMENTO
  const toastId = toast.loading('A IA está criando seus flashcards...');

  try {
    const generatedCards = await generateFlashcards(currentLesson.content);

    // 🟢 3. SALVAR NO CACHE / BANCO
    saveLessonAICache(selectedSubjectId, selectedLessonId, { flashcards: generatedCards });
    incrementAiUsage();

    setFlashcards(generatedCards);
    setIsFlashcardModalOpen(true);

    // 🟢 4. TOAST DE SUCESSO
    toast.success(`${generatedCards.length} flashcards criados!`, { id: toastId });
  } catch (err) {
    console.error("Erro ao gerar flashcards:", err);
    toast.error('Erro ao gerar flashcards. Tente novamente.', { id: toastId });
  }
};

const handleCheckout = async () => {
  try {
    toast.info('Redirecionando para o pagamento...');

    // Pega o usuário logado atualmente no Firebase
    const currentUser = auth.currentUser;

    const response = await fetch('/api/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser ? currentUser.uid : 'guest_' + Date.now(),
        email: currentUser?.email || 'estudante@cadernodigital.com'
      })
    });

    const data = await response.json();

    if (data.init_point) {
      // Redireciona para o checkout do Mercado Pago
      window.location.href = data.init_point; 
    } else {
      toast.error('Erro ao gerar o link de pagamento.');
    }
  } catch (error) {
    console.error(error);
    toast.error('Falha na comunicação com o servidor.');
  }
};


  // Adicione o isAuthReady junto com seus outros estados
  const [isAuthReady, setIsAuthReady] = useState(false);

  const {
    user, setUser, courses, selectedCourseId, selectedSemesterId, selectedSubjectId, selectedLessonId,
    setSelectedCourseId, setSelectedSemesterId, setSelectedSubjectId, setSelectedLessonId,
    addCourse, editCourse, deleteCourse, reorderCourses,
    addSemester, editSemester, deleteSemester, reorderSemesters,
    addSubject, editSubject, deleteSubject, reorderSubjects,
    addChapter, editChapter, deleteChapter, reorderChapters,
    addLesson, editLesson, deleteLesson, reorderLessons, saveLessonContent, saveLessonAICache,
    canGenerateAiContent,
    incrementAiUsage
  } = useNotebookStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (typeof setUser === 'function') {
          setUser({
            displayName: currentUser.displayName || currentUser.email || 'Usuário',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || '',
            uid: currentUser.uid
          });
        }
      } else {
        if (typeof setUser === 'function') setUser(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: null, item: null });

  // ESTADOS DE MODAIS
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
  const [genericModalTitle, setGenericModalTitle] = useState('');
  const [genericInputValue, setGenericInputValue] = useState('');
  const [genericOnConfirm, setGenericOnConfirm] = useState(null);

  // DRAG AND DROP
  const [draggedIndex, setDraggedIndex] = useState(null);

  // FORMULÁRIO COM ÍCONES E CORES
  const [courseName, setCourseName] = useState('');
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editingSemester, setEditingSemester] = useState(null);
  const [semesterName, setSemesterName] = useState('');
  const [semesterType, setSemesterType] = useState('standard'); // 'standard' ou 'custom'
  const [semesterNumber, setSemesterNumber] = useState('1º');
  const [subjectName, setSubjectName] = useState('');
  const [selectedIconKey, setSelectedIconKey] = useState('BookOpen');
  const [selectedColor, setSelectedColor] = useState('from-blue-600 to-indigo-700');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  const triggerConfetti = () => confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });

  // DADOS SELECIONADOS
  const currentCourse = courses.find(c => c.id === selectedCourseId);
  const currentSemester = currentCourse?.semesters.find(s => s.id === selectedSemesterId);
  const currentSubject = currentSemester?.subjects.find(sub => sub.id === selectedSubjectId);
  
  // AULA ATUAL
  const currentLesson = useMemo(() => {
    if (!selectedLessonId) return null;
    for (const c of courses) {
      for (const s of c.semesters) {
        for (const sub of s.subjects) {
          for (const chap of sub.chapters) {
            const found = chap.lessons.find(l => l.id === selectedLessonId);
            if (found) return found;
          }
        }
      }
    }
    return null;
  }, [courses, selectedLessonId]);

  // Extrai texto simples para busca
  const extractPlainText = (content) => {
    if (!content) return '';
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed.map(block => {
            if (typeof block.content === 'string') return block.content;
            if (Array.isArray(block.content)) {
              return block.content.map(c => c.text || '').join(' ');
            }
            return '';
          }).join(' ');
        }
      } catch {
        return content.replace(/<[^>]*>?/gm, '');
      }
    }
    return '';
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results = [];

    courses.forEach(course => {
      course.semesters.forEach(sem => {
        sem.subjects.forEach(sub => {
          if ((searchFilter === 'all' || searchFilter === 'subjects') && sub.name.toLowerCase().includes(q)) {
            results.push({ id: sub.id, type: 'Matéria', title: sub.name, detail: `${course.name} • ${sem.name}`, courseId: course.id, semesterId: sem.id, subjectId: sub.id });
          }
          sub.chapters.forEach(chap => {
            chap.lessons.forEach(less => {
              const titleMatch = less.title.toLowerCase().includes(q);
              const plainContent = extractPlainText(less.content);
              const contentMatch = plainContent.toLowerCase().includes(q);

              if (searchFilter === 'lessons' && titleMatch) {
                results.push({ id: less.id, type: 'Aula', title: less.title, detail: `${sub.name} • ${chap.title}`, courseId: course.id, semesterId: sem.id, subjectId: sub.id, lessonId: less.id });
              } else if (searchFilter === 'content' && contentMatch) {
                results.push({ id: less.id, type: 'Anotação', title: less.title, detail: `Trecho: "${plainContent.substring(Math.max(0, plainContent.toLowerCase().indexOf(q) - 15), 60)}..."`, courseId: course.id, semesterId: sem.id, subjectId: sub.id, lessonId: less.id });
              } else if (searchFilter === 'all' && (titleMatch || contentMatch)) {
                results.push({ id: less.id, type: titleMatch ? 'Aula' : 'Conteúdo', title: less.title, detail: `${sub.name} • ${chap.title}`, courseId: course.id, semesterId: sem.id, subjectId: sub.id, lessonId: less.id });
              }
            });
          });
        });
      });
    });
    return results;
  }, [searchQuery, searchFilter, courses]);

  // LOGIN VIA GOOGLE
  // LOGIN VIA GOOGLE INTEGRADO COM FIREBASE AUTH
  // LOGIN VIA GOOGLE (DIRETO PELO FIREBASE POPUP)
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // O próprio Firebase abre a janela e faz a autenticação
      const result = await signInWithPopup(auth, provider);

      triggerConfetti();
      toast.success(`Bem-vindo(a), ${result.user.displayName || 'Estudante'}!`);
    } catch (err) {
      console.error("Erro na autenticação Firebase com Google:", err);
      toast.error('Erro ao conectar com o Firebase.');
    }
  };

  // DEMO LOGIN
  const handleGuestLogin = () => {
    setUser({ name: 'Estudante Visitante', isGuest: true }); // 👈 Tiramos o e-mail daqui!
    triggerConfetti();
    toast.success('Entrou como visitante!');
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetIndex, type, extraId = null) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    if (type === 'course') reorderCourses(draggedIndex, targetIndex);
    if (type === 'semester') reorderSemesters(draggedIndex, targetIndex);
    if (type === 'subject') reorderSubjects(selectedSemesterId, draggedIndex, targetIndex);
    if (type === 'chapter') reorderChapters(selectedSubjectId, draggedIndex, targetIndex);
    if (type === 'lesson') reorderLessons(selectedSubjectId, extraId, draggedIndex, targetIndex);
    setDraggedIndex(null);
    toast.success('Ordem atualizada!');
  };

  const handleContextMenu = (e, type, item) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ visible: true, x: e.clientX || rect.right - 100, y: e.clientY || rect.bottom, type, item });
  };

  useEffect(() => {
    const handlePopState = () => {
      // Se o usuário estiver dentro de uma aula, volta para a matéria
      if (selectedLessonId) {
        setSelectedLessonId(null);
      } 
      // Se estiver na matéria, volta para os semestres
      else if (selectedSubjectId) {
        setSelectedSubjectId(null);
      } 
      // Se estiver no semestre, volta para os cursos
      else if (selectedSemesterId) {
        setSelectedSemesterId(null);
      } 
      // Se estiver nos cursos, volta para o início
      else if (selectedCourseId) {
        setSelectedCourseId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedCourseId, selectedSemesterId, selectedSubjectId, selectedLessonId]);

  if (!isAuthReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium animate-pulse">Carregando seu caderno...</p>
      </div>
    );
  }

  const handleExportPDF = async () => {
  // Pega o contêiner do editor
  const element = document.querySelector('.bn-editor') || 
                  document.querySelector('.bn-container') || 
                  document.querySelector('.blocknote-editor');

  if (!element) {
    toast.error("Conteúdo da aula não encontrado para exportar.");
    return;
  }

  const toastId = toast.loading("Gerando PDF...");

  // Busca o título exibido na tela (h1, h2 ou h3) para usar no nome do arquivo
  const titleElement = document.querySelector('h1') || document.querySelector('h2') || document.querySelector('h3');
  const lessonTitle = titleElement ? titleElement.innerText.replace(/[^a-zA-Z0-9 -]/g, "").trim() : 'Anotacao';

  try {
    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `Aula_${lessonTitle}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth || 800
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().set(opt).from(element).save();

    toast.success("PDF gerado com sucesso!", { id: toastId });
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    toast.error("Erro ao processar PDF. Verifique o console.", { id: toastId });
  }
};

  return (
      <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 md:p-8 relative">
        <Toaster position="bottom-right" richColors />

        {/* 1. TELA DE LOGIN COM GOOGLE */}
        {!user ? (
          <div className="min-h-[85vh] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-indigo-200">
                <GraduationCap className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">Meu Caderno Digital</h1>
              <p className="text-xs text-slate-500 mb-8 leading-relaxed">
                Acesse suas anotações, aulas e matérias de forma organizada com sua conta Google.
              </p>

              <div className="flex justify-center mb-4">
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow cursor-pointer"
                >
                  <img 
                    src="https://www.svgrepo.com/show/475656/google-color.svg" 
                    className="w-5 h-5" 
                    alt="Google Logo" 
                  />
                  Fazer Login com o Google
                </button>
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-white px-2 text-slate-400">ou</span></div>
              </div>

              <button
                onClick={handleGuestLogin}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Entrar no modo Visitante</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* VISUALIZAÇÃO/EDIÇÃO DA AULA */}
            {selectedLessonId && currentLesson ? (
              <div className="max-w-4xl mx-auto">
                <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
                  <button
                    onClick={() => {
                      setConfirmDialog({
                        open: true,
                        title: 'Sair sem salvar?',
                        message: 'Atenção: Se você fez alterações e não salvou, elas serão perdidas. Deseja mesmo sair da aula?',
                        type: 'warning',
                        confirmText: 'Sim, sair',
                        onConfirm: () => setSelectedLessonId(null)
                      });
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar para Aulas
                  </button>

                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Exportar PDF
                  </button>

                  <button 
                    onClick={handleCheckout}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:opacity-90 transition"
                  >
                    ⚡ Seja Pro
                  </button>
                </div>

                {/* Barra de Ferramentas com Inteligência Artificial */}
                <div className="flex items-center gap-2 mb-4 p-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-xl shadow-sm">
                  <div className="flex items-center gap-1 text-purple-700 font-semibold text-xs px-2">
                    <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                    <span>Assistente IA:</span>
                  </div>

                  <button
                    onClick={handleGenerateSummary}
                    disabled={isAiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-100 text-purple-700 text-xs font-medium rounded-lg border border-purple-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Gerar Resumo
                  </button>

                  <button
                    onClick={handleGenerateFlashcards}
                    disabled={isAiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-100 text-purple-700 text-xs font-medium rounded-lg border border-purple-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Gerar Flashcards
                  </button>
                </div>

                <LessonEditor
                  key={`${selectedLessonId}-${currentLesson?.content?.length}`}
                  lesson={currentLesson}
                  onSave={(id, content) => {
                    if (currentSubject) {
                      saveLessonContent(currentSubject.id, id, content);
                      triggerConfetti();
                      toast.success('Anotação salva com sucesso!');
                    }
                  }}
                  onBack={() => {
                    setConfirmDialog({
                      open: true,
                      title: 'Sair sem salvar?',
                      message: 'Atenção: Se você fez alterações e não salvou, elas serão perdidas. Deseja mesmo sair da aula?',
                      type: 'warning',
                      confirmText: 'Sim, sair',
                      onConfirm: () => setSelectedLessonId(null)
                    });
                  }}
                />
              </div>
            ) : (
              <>
                {/* HEADER PRINCIPAL */}
                <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5 font-medium">
                      <button onClick={() => setSelectedCourseId(null)} className="hover:text-indigo-600 cursor-pointer">
                        Meus Cursos
                      </button>
                      {currentCourse && (
                        <>
                          <span>/</span>
                          <button onClick={() => setSelectedSemesterId(null)} className="hover:text-indigo-600 cursor-pointer">
                            {currentCourse.name}
                          </button>
                        </>
                      )}
                      {currentSemester && (
                        <>
                          <span>/</span>
                          <button onClick={() => setSelectedSubjectId(null)} className="hover:text-indigo-600 cursor-pointer">
                            {currentSemester.name}
                          </button>
                        </>
                      )}
                      {currentSubject && (
                        <>
                          <span>/</span>
                          <span className="text-indigo-600 font-bold">{currentSubject.name}</span>
                        </>
                      )}
                    </div>

                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                      {!selectedCourseId ? 'Selecione seu Curso' : !selectedSemesterId ? 'Selecione o Semestre' : !selectedSubjectId ? 'Minhas Matérias' : currentSubject.name}
                    </h1>
                  </div>

                  {/* BUSCA COM FILTROS & PERFIL DO USUÁRIO */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-full md:w-80">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          placeholder="Buscar aulas, matérias ou textos..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-sm"
                        />
                      </div>

                      {searchQuery.trim() && (
                        <div className="absolute top-12 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 max-h-80 overflow-y-auto">
                          <div className="flex items-center gap-1 mb-3 pb-2 border-b border-slate-100 overflow-x-auto text-[10px]">
                            <Filter className="w-3 h-3 text-slate-400 shrink-0 mr-1" />
                            {[
                              { id: 'all', label: 'Tudo' },
                              { id: 'lessons', label: 'Aulas' },
                              { id: 'content', label: 'Conteúdo' },
                              { id: 'subjects', label: 'Matérias' }
                            ].map(f => (
                              <button
                                key={f.id}
                                onClick={() => setSearchFilter(f.id)}
                                className={`px-2.5 py-1 rounded-full font-semibold cursor-pointer transition-all ${
                                  searchFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>

                          {searchResults.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">Nenhum resultado encontrado.</p>
                          ) : (
                            searchResults.map((res) => (
                              <button
                                key={`${res.type}-${res.id}`}
                                onClick={() => {
                                  setSelectedCourseId(res.courseId);
                                  setSelectedSemesterId(res.semesterId);
                                  setSelectedSubjectId(res.subjectId);
                                  if (res.lessonId) setSelectedLessonId(res.lessonId);
                                  setSearchQuery('');
                                  window.history.pushState({ tela: 'interna' }, '');
                                }}
                                className="w-full text-left p-2.5 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer flex flex-col gap-0.5 mb-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-800">{res.title}</span>
                                  <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded">{res.type}</span>
                                </div>
                                <span className="text-[10px] text-slate-400">{res.detail}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* AVATAR DO USUÁRIO LOGADO */}
                    <div className="flex items-center gap-2 bg-white p-1.5 pl-3 border border-slate-200 rounded-2xl shadow-sm shrink-0">
                      {(user?.photoURL || user?.picture) ? (
                        <img src={user.photoURL || user.picture} alt="Avatar" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-xs">
                          {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-bold text-slate-700 hidden sm:inline max-w-[100px] truncate">
                        {(user?.displayName || user?.email || 'Usuário').split(' ')[0]}
                      </span>
                      <button 
                        onClick={() => { setUser(null); toast.info('Sessão encerrada.'); }}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all cursor-pointer ml-1"
                        title="Sair da Conta"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </header>

                <main className="max-w-7xl mx-auto">
                  {/* NÍVEL 0: MEUS CURSOS */}
                  {!selectedCourseId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {courses.map((course, index) => {
                        const IconComp = ICON_MAP[course.iconKey] || GraduationCap;
                        return (
                          <div
                            key={course.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, index, 'course')}
                            onClick={() => {setSelectedCourseId(course.id);window.history.pushState({ tela: 'interna' }, '');}}
                            onContextMenu={(e) => handleContextMenu(e, 'course', course)}
                            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex items-center justify-between group relative"
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${course.color || 'from-blue-600 to-indigo-700'} text-white shadow-md`}>
                                <IconComp className="w-6 h-6" />
                              </div>
                              <div>
                                <h2 className="font-bold text-lg text-slate-900">{course.name}</h2>
                                <p className="text-xs text-slate-400">{course.semesters.length} semestres</p>
                              </div>
                            </div>

                            <button
                              onClick={(e) => handleContextMenu(e, 'course', course)}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}

                      <button
                        onClick={() => {
                          setEditingCourse(null);
                          setCourseName('');
                          setSelectedIconKey('GraduationCap');
                          setSelectedColor('from-blue-600 to-indigo-700');
                          setIsCourseModalOpen(true);
                        }}
                        className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-200/20 hover:bg-indigo-50/20 rounded-2xl p-6 flex items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 transition-all font-semibold text-sm cursor-pointer"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Adicionar Curso</span>
                      </button>
                    </div>
                  )}

                  {/* NÍVEL 1: SEMESTRES */}
                  {selectedCourseId && !selectedSemesterId && (
                    <div>
                      <button 
                        onClick={() => setSelectedCourseId(null)}
                        className="mb-6 text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" /> Voltar para Cursos
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {currentCourse?.semesters.map((sem, index) => (
                          <div
                            key={sem.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, index, 'semester')}
                            onClick={() => {setSelectedSemesterId(sem.id);window.history.pushState({ tela: 'interna' }, '');}}
                            onContextMenu={(e) => handleContextMenu(e, 'semester', sem)}
                            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex items-center justify-between group relative"
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Calendar className="w-6 h-6" />
                              </div>
                              <div>
                                <h2 className="font-bold text-lg text-slate-900">{sem.name}</h2>
                                <p className="text-xs text-slate-400">{sem.subjects.length} matérias</p>
                              </div>
                            </div>

                            <button
                              onClick={(e) => handleContextMenu(e, 'semester', sem)}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => {
                            setEditingSemester(null);
                            setSemesterName('');
                            setIsSemesterModalOpen(true);
                            window.history.pushState({ tela: 'interna' }, '');
                          }}
                          className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-200/20 hover:bg-indigo-50/20 rounded-2xl p-6 flex items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 transition-all font-semibold text-sm cursor-pointer"
                        >
                          <Plus className="w-5 h-5" />
                          <span>Adicionar Semestre</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* NÍVEL 2: MATÉRIAS */}
                  {selectedSemesterId && !selectedSubjectId && (
                    <div>
                      <button 
                        onClick={() => setSelectedSemesterId(null)}
                        className="mb-6 text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" /> Voltar para Semestres
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {currentSemester?.subjects.map((sub, index) => {
                          const IconComponent = ICON_MAP[sub.iconKey] || BookOpen;
                          return (
                            <div
                              key={sub.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, index, 'subject')}
                              onClick={() => {setSelectedSubjectId(sub.id);window.history.pushState({ tela: 'interna' }, '');}}
                              onContextMenu={(e) => handleContextMenu(e, 'subject', sub)}
                              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all cursor-pointer flex flex-col justify-between min-h-[180px] group relative"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${sub.color || 'from-blue-600 to-indigo-700'} text-white shadow-md`}>
                                    <IconComponent className="w-6 h-6" />
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-full mr-1">
                                    {sub.chapters.length} cap.
                                  </span>
                                  <button
                                    onClick={(e) => handleContextMenu(e, 'subject', sub)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div>
                                <h2 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  {sub.name}
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">
                                  {sub.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0)} aulas salvas
                                </p>
                              </div>
                            </div>
                          );
                        })}

                        <button
                          onClick={() => {
                            setEditingSubject(null);
                            setSubjectName('');
                            setSelectedIconKey('BookOpen');
                            setSelectedColor('from-blue-600 to-indigo-700');
                            setIsSubjectModalOpen(true);
                          }}
                          className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-200/20 hover:bg-indigo-50/20 rounded-2xl p-6 min-h-[180px] flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-indigo-600 transition-all font-semibold text-sm cursor-pointer group"
                        >
                          <Plus className="w-6 h-6 text-indigo-600" />
                          <span>Adicionar Matéria</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* NÍVEL 3: CAPÍTULOS E AULAS */}
                  {selectedSubjectId && (
                    <div>
                      <button 
                        onClick={() => setSelectedSubjectId(null)}
                        className="mb-6 text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" /> Voltar para Matérias
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                        {currentSubject?.chapters.map((chapter, chapIndex) => (
                          <div
                            key={chapter.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, chapIndex)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, chapIndex, 'chapter')}
                            onContextMenu={(e) => handleContextMenu(e, 'chapter', chapter)}
                            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <h2 className="font-bold text-base text-slate-800 truncate pr-2">
                                    {chapter.title}
                                  </h2>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[11px] bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-medium">
                                    {chapter.lessons.length} aulas
                                  </span>
                                  <button
                                    onClick={(e) => handleContextMenu(e, 'chapter', chapter)}
                                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1.5 mb-4">
                                {chapter.lessons.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic py-2">Nenhuma aula criada ainda.</p>
                                ) : (
                                  chapter.lessons.map((lesson, lessIndex) => (
                                    <div
                                      key={lesson.id}
                                      draggable
                                      onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, lessIndex); }}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={(e) => { e.stopPropagation(); handleDrop(e, lessIndex, 'lesson', chapter.id); }}
                                      onClick={() => {setSelectedLessonId(lesson.id);window.history.pushState({ tela: 'interna' }, '');}}
                                      onContextMenu={(e) => handleContextMenu(e, 'lesson', lesson)}
                                      className="w-full text-left flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 transition-all text-sm group cursor-pointer border border-transparent hover:border-indigo-100"
                                    >
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="text-slate-300 group-hover:text-indigo-400 cursor-grab active:cursor-grabbing shrink-0">
                                          <GripVertical className="w-3.5 h-3.5" />
                                        </div>
                                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                                        <span className="truncate font-medium">{lesson.title}</span>
                                      </div>

                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleContextMenu(e, 'lesson', lesson); }}
                                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-all"
                                      >
                                        <MoreVertical className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setGenericModalTitle('Título da Nova Aula');
                                setGenericInputValue('');
                                setGenericOnConfirm(() => (val) => {
                                  addLesson(currentSubject.id, chapter.id, val);
                                  toast.success('Aula criada!');
                                });
                                setIsGenericModalOpen(true);
                              }}
                              className="w-full py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200 border-dashed"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Adicionar Aula</span>
                            </button>
                          </div>
                        ))}

                        <button
                          onClick={() => {
                            setGenericModalTitle('Título do Novo Capítulo');
                            setGenericInputValue('');
                            setGenericOnConfirm(() => (val) => {
                              addChapter(currentSubject.id, val);
                              toast.success('Capítulo criado!');
                            });
                            setIsGenericModalOpen(true);
                          }}
                          className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-200/20 hover:bg-indigo-50/20 rounded-2xl p-6 min-h-[200px] flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-indigo-600 transition-all font-semibold text-sm cursor-pointer"
                        >
                          <Plus className="w-6 h-6 text-indigo-600" />
                          <span>Adicionar Capítulo</span>
                        </button>
                      </div>
                    </div>
                  )}
                </main>
              </>
            )}

            {/* MENU DE CONTEXTO / OPÇÕES */}
            {contextMenu.visible && (
              <div 
                className="fixed bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 w-44 z-50 text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
                style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
              >
                <button
                  onClick={() => {
                    const { type, item } = contextMenu;
                    setContextMenu({ visible: false, x: 0, y: 0, type: null, item: null });
                    if (type === 'course') {
                      setEditingCourse(item);
                      setCourseName(item.name);
                      setSelectedIconKey(item.iconKey || 'GraduationCap');
                      setSelectedColor(item.color || 'from-blue-600 to-indigo-700');
                      setIsCourseModalOpen(true);
                    } else if (type === 'semester') {
                      setEditingSemester(item);
                      setSemesterName(item.name);
                      setIsSemesterModalOpen(true);
                    } else if (type === 'subject') {
                      setEditingSubject(item);
                      setSubjectName(item.name);
                      setSelectedIconKey(item.iconKey || 'BookOpen');
                      setSelectedColor(item.color || 'from-blue-600 to-indigo-700');
                      setIsSubjectModalOpen(true);
                    } else if (type === 'chapter') {
                      setGenericModalTitle('Editar Capítulo');
                      setGenericInputValue(item.title);
                      setGenericOnConfirm(() => (val) => {
                        editChapter(currentSubject.id, item.id, val);
                        toast.success('Capítulo atualizado!');
                      });
                      setIsGenericModalOpen(true);
                    } else if (type === 'lesson') {
                      setGenericModalTitle('Editar Aula');
                      setGenericInputValue(item.title);
                      setGenericOnConfirm(() => (val) => {
                        editLesson(currentSubject.id, item.id, val);
                        toast.success('Aula atualizada!');
                      });
                      setIsGenericModalOpen(true);
                    }
                  }}
                  className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Editar</span>
                </button>

                <button
                  onClick={() => {
                    const { type, item } = contextMenu;
                    setContextMenu({ visible: false, x: 0, y: 0, type: null, item: null });
                    setConfirmDialog({
                      open: true,
                      title: 'Excluir Item',
                      message: `Tem certeza de que deseja excluir "${item.name || item.title}"? Esta ação não poderá ser desfeita.`,
                      onConfirm: () => {
                        if (type === 'course') deleteCourse(item.id);
                        if (type === 'semester') deleteSemester(item.id);
                        if (type === 'subject') deleteSubject(item.id);
                        if (type === 'chapter') deleteChapter(currentSubject.id, item.id);
                        if (type === 'lesson') deleteLesson(currentSubject.id, item.id);
                        toast.success('Item excluído!');
                      }
                    });
                  }}
                  className="w-full px-4 py-2 hover:bg-rose-50 flex items-center gap-2.5 text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            )}

            {/* MODAL CURSO */}
            {isCourseModalOpen && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-slate-900">{editingCourse ? 'Editar Curso' : 'Novo Curso'}</h3>
                    <button onClick={() => setIsCourseModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Nome do Curso</label>
                      <input
                        type="text"
                        placeholder="Ex: Medicina, Direito..."
                        value={courseName}
                        onChange={(e) => setCourseName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-2 block">Selecione o Ícone</label>
                      <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                        {Object.keys(ICON_MAP).map(iconKey => {
                          const IconComp = ICON_MAP[iconKey];
                          return (
                            <button
                              key={iconKey}
                              onClick={() => setSelectedIconKey(iconKey)}
                              className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                selectedIconKey === iconKey ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <IconComp className="w-5 h-5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-2 block">Cor de Destaque</label>
                      <div className="grid grid-cols-3 gap-2">
                        {COLOR_OPTIONS.map(c => (
                          <button
                            key={c.name}
                            onClick={() => setSelectedColor(c.value)}
                            className={`h-9 rounded-xl bg-gradient-to-r ${c.value} flex items-center justify-center transition-all cursor-pointer ${
                              selectedColor === c.value ? 'ring-2 ring-indigo-600 ring-offset-2' : 'opacity-80 hover:opacity-100'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setIsCourseModalOpen(false)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (!courseName.trim()) return toast.error('Digite um nome válido!');
                          if (editingCourse) {
                            editCourse(editingCourse.id, courseName, selectedIconKey, selectedColor);
                            toast.success('Curso atualizado!');
                          } else {
                            addCourse(courseName, selectedIconKey, selectedColor);
                            toast.success('Curso criado!');
                          }
                          setIsCourseModalOpen(false);
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL SEMESTRE */}
            {isSemesterModalOpen && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-slate-900">{editingSemester ? 'Editar Semestre' : 'Novo Semestre'}</h3>
                    <button onClick={() => setIsSemesterModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setSemesterType('standard')}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${semesterType === 'standard' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Padrão
                      </button>
                      <button
                        onClick={() => setSemesterType('custom')}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${semesterType === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Personalizado
                      </button>
                    </div>

                    {semesterType === 'standard' ? (
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Selecione o Semestre</label>
                        <select
                          value={semesterNumber}
                          onChange={(e) => setSemesterNumber(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                            <option key={num} value={`${num}º`}>{num}º Semestre</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Nome do Semestre (Livre)</label>
                        <input
                          type="text"
                          placeholder="Ex: Nivelamento 2026.1..."
                          value={semesterName}
                          onChange={(e) => setSemesterName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setIsSemesterModalOpen(false)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          const finalName = semesterType === 'standard' ? `${semesterNumber} Semestre` : semesterName;
                          
                          if (!finalName.trim()) return toast.error('Nome inválido!');
                          
                          if (editingSemester) {
                            editSemester(editingSemester.id, finalName);
                            toast.success('Semestre atualizado!');
                          } else {
                            addSemester(selectedCourseId, finalName);
                            toast.success('Semestre criado!');
                          }
                          setIsSemesterModalOpen(false);
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL MATÉRIA */}
            {isSubjectModalOpen && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-slate-900">{editingSubject ? 'Editar Matéria' : 'Nova Matéria'}</h3>
                    <button onClick={() => setIsSubjectModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Nome da Matéria</label>
                      <input
                        type="text"
                        placeholder="Ex: Anatomia Humana..."
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-2 block">Selecione o Ícone</label>
                      <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                        {Object.keys(ICON_MAP).map(iconKey => {
                          const IconComp = ICON_MAP[iconKey];
                          return (
                            <button
                              key={iconKey}
                              onClick={() => setSelectedIconKey(iconKey)}
                              className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                selectedIconKey === iconKey ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <IconComp className="w-5 h-5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-2 block">Cor de Destaque</label>
                      <div className="grid grid-cols-3 gap-2">
                        {COLOR_OPTIONS.map(c => (
                          <button
                            key={c.name}
                            onClick={() => setSelectedColor(c.value)}
                            className={`h-9 rounded-xl bg-gradient-to-r ${c.value} flex items-center justify-center transition-all cursor-pointer ${
                              selectedColor === c.value ? 'ring-2 ring-indigo-600 ring-offset-2' : 'opacity-80 hover:opacity-100'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setIsSubjectModalOpen(false)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (!subjectName.trim()) return toast.error('Digite um nome válido!');
                          if (editingSubject) {
                            editSubject(editingSubject.id, {
                              name: subjectName,
                              iconKey: selectedIconKey,
                              color: selectedColor
                            });
                            toast.success('Matéria atualizada!');
                          } else {
                            addSubject(selectedSemesterId, {
                              name: subjectName,
                              iconKey: selectedIconKey,
                              color: selectedColor
                            });
                            toast.success('Matéria criada!');
                          }
                          setIsSubjectModalOpen(false);
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL GENÉRICO (CAPÍTULO OU AULA) */}
            {isGenericModalOpen && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-slate-900">{genericModalTitle}</h3>
                    <button onClick={() => setIsGenericModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Digite o título..."
                      value={genericInputValue}
                      onChange={(e) => setGenericInputValue(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setIsGenericModalOpen(false)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (!genericInputValue.trim()) return toast.error('Digite um texto válido!');
                          if (genericOnConfirm) genericOnConfirm(genericInputValue);
                          setIsGenericModalOpen(false);
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DIÁLOGO DE CONFIRMAÇÃO (EXCLUSÃO OU AVISOS) */}
            {confirmDialog.open && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-center">
                  
                  {/* Ícone e cor dinâmicos */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                    confirmDialog.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    {confirmDialog.type === 'warning' ? <ArrowLeft className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
                  </div>
                  
                  <h3 className="font-bold text-lg text-slate-900 mb-1">{confirmDialog.title}</h3>
                  <p className="text-xs text-slate-500 mb-6">{confirmDialog.message}</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
                      }}
                      className={`flex-1 py-2.5 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md ${
                        confirmDialog.type === 'warning' 
                          ? 'bg-amber-500 hover:bg-amber-600' 
                          : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      {confirmDialog.confirmText || 'Excluir'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {/* 🟢 COLE O MODAL AQUI */}
      <FlashcardModal 
        isOpen={isFlashcardModalOpen} 
        onClose={() => setIsFlashcardModalOpen(false)} 
        flashcards={flashcards} 
      />
      <SummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        summaryText={summaryResult}
        onInsert={handleInsertSummaryToNote}
      />
      </div>
  );
}