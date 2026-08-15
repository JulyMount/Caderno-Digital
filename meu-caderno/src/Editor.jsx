import React, { useState, useMemo, useEffect } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { Save, Sparkles, Check } from 'lucide-react';

export default function LessonEditor({ lesson, onSave, onBack }) {
  const [isSaved, setIsSaved] = useState(false);

  // Função para converter arquivos do seu computador em Base64 para salvar localmente
  const handleFileUpload = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Converte qualquer tipo de conteúdo antigo para blocos válidos do BlockNote (Evita Tela Branca)
  const initialBlocks = useMemo(() => {
    if (!lesson || !lesson.content) return undefined;

    if (Array.isArray(lesson.content)) return lesson.content;

    if (typeof lesson.content === 'string') {
      try {
        const parsed = JSON.parse(lesson.content);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        if (lesson.content.trim()) {
          return [
            {
              type: 'paragraph',
              content: lesson.content
            }
          ];
        }
      }
    }
    return undefined;
  }, [lesson?.id]);

  // Inicializa o Editor Notion ativando a opção de upload de arquivos do PC
  const editor = useCreateBlockNote({
    initialContent: initialBlocks,
    uploadFile: handleFileUpload
  });

  // 👇 COLE A PARTIR DAQUI (Logo abaixo do editor) 👇
  useEffect(() => {
    window.insertSummaryToEditor = async (markdownText) => {
      if (!editor) return;

      try {
        // Converte a string de Markdown em blocos reais do BlockNote
        const blocks = await editor.tryParseMarkdownToBlocks(markdownText);
        
        // Pega o último bloco para inserir no final
        const lastBlock = editor.document[editor.document.length - 1];
        
        // Insere os novos blocos formatados
        editor.insertBlocks(blocks, lastBlock, 'after');
      } catch (error) {
        console.error("Erro ao converter Markdown para blocos no BlockNote:", error);
      }
    };
  }, [editor]);

  const handleSave = () => {
    if (!editor) return;
    const blocks = editor.document;
    onSave(lesson.id, JSON.stringify(blocks));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  if (!lesson) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center">
        <p className="text-slate-500 text-sm">Nenhuma aula selecionada.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
      {/* Cabeçalho do Editor */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md flex items-center gap-1 w-fit mb-1">
            <Sparkles className="w-3 h-3" /> Caderno Digital • Editor Notion
          </span>
          <h2 className="text-xl font-black text-slate-900">{lesson.title}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-all cursor-pointer ${
              isSaved
                ? 'bg-emerald-600 text-white shadow-emerald-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'Salvo!' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      {/* Dica de Atalhos */}
      <div className="px-6 py-2 bg-indigo-50/60 border-b border-indigo-100 text-[11px] text-indigo-700 font-medium flex items-center justify-between">
        <span>💡 Digite <kbd className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 font-bold text-indigo-900">/</kbd> para inserir Imagens, Tabelas, Listas ou Fórmulas.</span>
      </div>

      {/* Área do Editor */}
      <div className="p-6 min-h-[450px]">
        <BlockNoteView key={lesson.id} editor={editor} theme="light" />
      </div>
    </div>
  );
}