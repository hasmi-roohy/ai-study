/**
 * Curated eval cases (PRD §46 AI Evaluation). Each case describes an input scenario
 * and an expected property of the output — not necessarily an exact string match,
 * since LLM output is non-deterministic. Grading logic lives in runEvals.ts.
 */
export const TUTOR_GROUNDEDNESS_CASES = [
  {
    id: 'grounded-basic',
    description: 'Question directly answerable from provided evidence should be marked grounded.',
    evidence: ['A neural network is composed of layers of interconnected nodes called neurons, organized into an input layer, one or more hidden layers, and an output layer.'],
    question: 'What are the layers of a neural network called?',
    expect: { grounded: true }
  },
  {
    id: 'unsupported-question',
    description: 'Question with no relevant evidence should be marked ungrounded rather than answered confidently.',
    evidence: ['A neural network is composed of layers of interconnected nodes called neurons.'],
    question: 'What is the current stock price of NVIDIA?',
    expect: { grounded: false }
  }
];

export const GRADING_QUALITY_CASES = [
  {
    id: 'grading-clearly-correct',
    description: 'A clearly correct, complete open-ended answer should score high and be marked correct.',
    concept: 'Gradient Descent',
    question: 'Explain how gradient descent updates model weights.',
    learnerAnswer:
      'Gradient descent computes the gradient of the loss function with respect to each weight, then updates each weight by subtracting a fraction (the learning rate) of that gradient, iteratively moving toward a minimum.',
    expect: { isCorrectAtLeast: true, minUnderstanding: 70 }
  },
  {
    id: 'grading-clearly-wrong',
    description: 'An answer unrelated to the question should score low and be marked incorrect.',
    concept: 'Gradient Descent',
    question: 'Explain how gradient descent updates model weights.',
    learnerAnswer: 'Gradient descent is a type of database index used to speed up SQL queries.',
    expect: { isCorrectAtLeast: false, maxUnderstanding: 30 }
  }
];
