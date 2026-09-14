'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { CheckIcon, AlertIcon } from '@/components/icons';

const QUESTIONS_PER_QUIZ = 6;

interface Question {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'OPEN_ENDED';
  difficulty: number;
  prompt: string;
  options?: string[];
  concept?: { name: string };
}

interface AnswerResult {
  isCorrect: boolean;
  feedback: { feedbackText: string; understanding?: number; missingConcepts?: string[] };
  nextQuestion: Question | null;
  isQuizComplete: boolean;
}

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Hard' };

export default function QuizTab({ projectId }: { projectId: string }) {
  const [quizId, setQuizId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  async function startQuiz() {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnsweredCount(0);
    setSelected(null);
    try {
      const data = await apiFetch<{ quiz: { id: string }; question: Question }>(`/api/projects/${projectId}/quiz`, { method: 'POST' });
      setQuizId(data.quiz.id);
      setQuestion(data.question);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(chosenAnswer: string) {
    if (!quizId || !question || !chosenAnswer.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch<AnswerResult>(`/api/projects/${projectId}/quiz/${quizId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ questionId: question.id, answer: chosenAnswer })
      });
      setResult(data);
      setAnsweredCount((c) => c + 1);
      setAnswer('');
    } finally {
      setLoading(false);
    }
  }

  function nextQuestion() {
    if (result?.nextQuestion) {
      setQuestion(result.nextQuestion);
      setResult(null);
      setSelected(null);
    }
  }

  if (!quizId) {
    return (
      <div className="surface p-8 text-center">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <p className="font-medium text-slate-800">Ready for an adaptive quiz?</p>
        <p className="mt-1 text-sm text-slate-500">Questions adjust to your mastery as you go.</p>
        <button onClick={startQuiz} disabled={loading} className="primary-button mt-5">
          {loading ? 'Starting…' : 'Start Adaptive Quiz'}
        </button>
      </div>
    );
  }

  if (result?.isQuizComplete) {
    return (
      <div className="surface max-w-lg p-6">
        <p className="flex items-center gap-2 font-medium text-slate-800"><CheckIcon className="h-5 w-5 text-emerald-600" /> Quiz complete!</p>
        <p className="mt-2 text-sm text-slate-500">Your mastery has been updated. Check Growth &amp; Analytics for your progress.</p>
        <button onClick={startQuiz} className="primary-button mt-4">Take another quiz</button>
      </div>
    );
  }

  const progressPct = Math.round((answeredCount / QUESTIONS_PER_QUIZ) * 100);

  return (
    <div className="max-w-xl">
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <span>Question {answeredCount + 1} of {QUESTIONS_PER_QUIZ}</span>
        <span>{progressPct}% complete</span>
      </div>
      <div className="progress-track mb-6"><div className="progress-fill" style={{ width: `${progressPct}%` }} /></div>

      {question && !result && (
        <div className="surface p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="tag-pill">{DIFFICULTY_LABEL[question.difficulty] ?? 'Medium'}</span>
            {question.concept?.name && <span className="tag-pill">{question.concept.name}</span>}
            <span className="tag-pill">{question.type === 'MULTIPLE_CHOICE' ? 'Multiple Choice' : 'Open Ended'}</span>
          </div>
          <p className="mb-5 text-[15px] font-medium text-slate-900">{question.prompt}</p>

          {question.type === 'MULTIPLE_CHOICE' ? (
            <div className="space-y-2">
              {question.options?.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelected(opt)}
                  disabled={loading}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
                    selected === opt ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selected === opt ? 'border-brand-600' : 'border-slate-300'}`}>
                    {selected === opt && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                  </span>
                  {opt}
                </button>
              ))}
              <button onClick={() => selected && submit(selected)} disabled={loading || !selected} className="primary-button mt-2">
                Submit Answer
              </button>
            </div>
          ) : (
            <div>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                className="form-control mb-3"
                placeholder="Type your answer…"
              />
              <button onClick={() => submit(answer)} disabled={loading || !answer.trim()} className="primary-button">
                Submit Answer
              </button>
            </div>
          )}
        </div>
      )}

      {result && !result.isQuizComplete && (
        <div className={`rounded-xl border p-5 ${result.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className={`flex items-center gap-1.5 text-sm font-semibold ${result.isCorrect ? 'text-emerald-700' : 'text-amber-700'}`}>
            {result.isCorrect ? <CheckIcon className="h-4 w-4" /> : <AlertIcon className="h-4 w-4" />}
            {result.isCorrect ? 'Correct answer' : 'Not quite'}
          </p>
          <p className={`mt-2 text-sm ${result.isCorrect ? 'text-emerald-900' : 'text-amber-900'}`}>{result.feedback.feedbackText}</p>
          {result.feedback.missingConcepts && result.feedback.missingConcepts.length > 0 && (
            <p className="mt-2 text-xs text-amber-800">Missing: {result.feedback.missingConcepts.join(', ')}</p>
          )}
          <button onClick={nextQuestion} className="primary-button mt-4">Next question</button>
        </div>
      )}
    </div>
  );
}
