import React, { useState } from 'react';

// Componente leve para renderizar o Markdown em HTML bonito
function FormattedMarkdown({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let currentList = [];

  // Converte **texto** em negrito destacado
  const parseInline = (str) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-semibold text-purple-900 dark:text-purple-200">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const flushList = (key) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} className="list-disc list-inside space-y-1.5 my-2 pl-2">
          {currentList.map((item, idx) => (
            <li key={idx} className="text-gray-700 dark:text-gray-300">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ')) {
      flushList(index);
      elements.push(
        <h1 key={index} className="text-xl font-bold text-purple-800 dark:text-purple-300 mt-4 mb-2">
          {parseInline(trimmed.replace(/^#\s+/, ''))}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList(index);
      elements.push(
        <h2 key={index} className="text-lg font-bold text-purple-700 dark:text-purple-300 mt-3 mb-2">
          {parseInline(trimmed.replace(/^##\s+/, ''))}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      flushList(index);
      elements.push(
        <h3 key={index} className="text-base font-bold text-purple-600 dark:text-purple-400 mt-3 mb-1">
          {parseInline(trimmed.replace(/^###\s+/, ''))}
        </h3>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.replace(/^[-*]\s+/, ''));
    } else if (trimmed === '') {
      flushList(index);
    } else {
      flushList(index);
      elements.push(
        <p key={index} className="mb-2 text-gray-700 dark:text-gray-300 leading-relaxed">
          {parseInline(trimmed)}
        </p>
      );
    }
  });

  flushList('final');
  return <div className="space-y-1">{elements}</div>;
}

export default function SummaryModal({ isOpen, onClose, summaryText, onInsert }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-purple-100 dark:border-gray-700">
        
        {/* Cabeçalho */}
        <div className="p-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h3 className="text-lg font-bold">Resumo Inteligente</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo do Resumo Formatado */}
        <div className="p-6 overflow-y-auto flex-1">
          <FormattedMarkdown content={summaryText} />
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-3 justify-end items-center">
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors flex items-center gap-1.5"
          >
            {copied ? '✅ Copiado!' : '📋 Copiar Texto'}
          </button>

          <button
            onClick={() => {
              onInsert(summaryText);
              onClose();
            }}
            className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-95 flex items-center gap-2"
          >
            📌 Inserir no Final da Aula
          </button>
        </div>

      </div>
    </div>
  );
}