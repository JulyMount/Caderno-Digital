import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCw, Sparkles, CheckCircle2 } from 'lucide-react';

export default function FlashcardModal({ isOpen, onClose, flashcards = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!isOpen || flashcards.length === 0) return null;

  const currentCard = flashcards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-2 text-purple-800 font-bold">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span>Flashcards de Estudo</span>
          </div>
          
          <button 
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/80 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Cartão */}
        <div className="p-6 flex flex-col items-center justify-center min-h-[280px]">
          
          {/* Card com efeito de Virar */}
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className={`w-full min-h-[220px] p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer select-none flex flex-col justify-between shadow-sm hover:shadow-md ${
              isFlipped 
                ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950' 
                : 'bg-white border-purple-100 text-slate-800 hover:border-purple-300'
            }`}
          >
            {/* Tag indicadora */}
            <div className="flex justify-between items-center w-full text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>{isFlipped ? '💡 Resposta' : '❓ Pergunta'}</span>
              <span className="flex items-center gap-1 text-purple-600">
                <RotateCw className="w-3 h-3" /> Clique para virar
              </span>
            </div>

            {/* Conteúdo da Pergunta ou Resposta */}
            <div className="my-auto py-4 text-center">
              <p className={`text-lg font-medium leading-relaxed ${isFlipped ? 'text-indigo-900' : 'text-slate-800'}`}>
                {isFlipped ? currentCard?.answer : currentCard?.question}
              </p>
            </div>

            {/* Dica no rodapé do card */}
            <div className="text-center text-xs text-slate-400 font-light">
              {isFlipped ? 'Clique novamente para ver a pergunta' : 'Pense na resposta e clique para conferir'}
            </div>
          </div>

        </div>

        {/* Rodapé e Controles */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
          
          {/* Botão Anterior */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:text-slate-900 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          {/* Contador de Cartões */}
          <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
            {currentIndex + 1} / {flashcards.length}
          </span>

          {/* Botão Próximo */}
          <button
            onClick={handleNext}
            disabled={currentIndex === flashcards.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-purple-700 disabled:opacity-30 disabled:cursor-not-allowed hover:text-purple-900 transition-all cursor-pointer"
          >
            Próximo <ChevronRight className="w-4 h-4" />
          </button>

        </div>

      </div>
    </div>
  );
}