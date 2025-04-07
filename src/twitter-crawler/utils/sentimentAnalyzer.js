/**
 * Advanced Sentiment Analyzer Module
 * This module provides sentiment analysis for crypto-related tweets
 * using ML-based approaches and specialized dictionaries.
 */

const natural = require('natural');
const Sentiment = require('sentiment');

// Basic sentiment analyzer (dictionary-based approach)
const sentimentAnalyzer = new Sentiment();

// Configure crypto-specific dictionary for more accurate sentiment analysis
const cryptoSpecificDictionary = {
  // Positive crypto terms
  'hodl': 2,
  'moon': 2, 
  'mooning': 2,
  'bullish': 3,
  'bull': 2,
  'surge': 2,
  'surging': 2,
  'rally': 2,
  'rallying': 2,
  'ath': 2, // all-time high
  'breakout': 2,
  'accumulate': 1,
  'accumulation': 1,
  'buy the dip': 2,
  'diamond hands': 2,
  'support': 1,
  'adoption': 2,
  'partnership': 1,
  'launched': 1,
  'launching': 1,
  'green': 1,
  
  // Negative crypto terms
  'bearish': -3,
  'bear': -2,
  'dump': -2,
  'dumping': -2,
  'correction': -1,
  'crash': -3,
  'crashing': -3,
  'scam': -3,
  'ponzi': -3,
  'rugpull': -3,
  'fud': -2, // fear, uncertainty, doubt
  'sell': -1,
  'selling': -1,
  'sold': -1,
  'paper hands': -1,
  'resistance': -1,
  'banned': -2,
  'ban': -2,
  'regulation': -1,
  'hack': -3,
  'hacked': -3,
  'exploit': -3,
  'whale': -1, // often negative in context of selling
  'red': -1,
};

// Tokenizer for text processing
const tokenizer = new natural.WordTokenizer();

// Naive Bayes Classifier for ML-based sentiment analysis
const classifier = new natural.BayesClassifier();

// Train the classifier with crypto-specific examples
function trainClassifier() {
  // Positive examples
  classifier.addDocument('BTC to the moon! Hodl strong.', 'positive');
  classifier.addDocument('This bull run is just getting started.', 'positive');
  classifier.addDocument('Bullish on ETH, great fundamentals.', 'positive');
  classifier.addDocument('Just bought more, long-term hodl.', 'positive');
  classifier.addDocument('The project has strong fundamentals.', 'positive');
  classifier.addDocument('New partnership announced, very promising!', 'positive');
  classifier.addDocument('This is going to be huge for crypto adoption.', 'positive');
  classifier.addDocument('Breaking ATH soon, buy now!', 'positive');
  classifier.addDocument('Accumulating during this dip.', 'positive');
  classifier.addDocument('This coin has real utility and solves problems.', 'positive');
  
  // Negative examples
  classifier.addDocument('Bear market is here, selling everything.', 'negative');
  classifier.addDocument('This project looks like a scam.', 'negative');
  classifier.addDocument('Massive dump incoming, be careful.', 'negative');
  classifier.addDocument('Regulations will kill crypto.', 'negative');
  classifier.addDocument('Whales are manipulating the price.', 'negative');
  classifier.addDocument('The chart looks terrible, expect more downside.', 'negative');
  classifier.addDocument('This is a classic rugpull, stay away.', 'negative');
  classifier.addDocument('Project failed to deliver on promises.', 'negative');
  classifier.addDocument('Team is selling their tokens, bad sign.', 'negative');
  classifier.addDocument('Hack reported, millions stolen.', 'negative');
  
  // Neutral examples
  classifier.addDocument('Bitcoin is a digital currency.', 'neutral');
  classifier.addDocument('The market is moving sideways today.', 'neutral');
  classifier.addDocument('What do you think about this project?', 'neutral');
  classifier.addDocument('Transferring my coins to a hardware wallet.', 'neutral');
  classifier.addDocument('New update coming next month.', 'neutral');
  classifier.addDocument('Trading volume is average today.', 'neutral');
  classifier.addDocument('The team is working on the roadmap.', 'neutral');
  classifier.addDocument('Gas fees are high right now.', 'neutral');
  classifier.addDocument('Many people still don\'t understand blockchain.', 'neutral');
  classifier.addDocument('The whitepaper explains the tokenomics.', 'neutral');

  // Train the classifier
  classifier.train();
}

// Initialize the classifier
trainClassifier();

/**
 * Analyzes the sentiment of crypto-related text
 * @param {string} text - The text to analyze
 * @param {Object} options - Optional configuration parameters
 * @returns {Object} - Sentiment analysis results
 */
function analyzeSentiment(text, options = {}) {
  if (!text) return { sentiment: 'neutral', score: 0, confidence: 0 };
  
  const lowerText = text.toLowerCase();
  
  // Hybrid approach: combine dictionary-based and ML approaches
  
  // 1. Dictionary-based analysis with crypto-specific terms
  const sentimentResult = sentimentAnalyzer.analyze(lowerText, {
    extras: cryptoSpecificDictionary
  });
  
  // 2. ML-based classification
  const classifierResult = classifier.getClassifications(lowerText);
  const mlSentiment = classifier.classify(lowerText);
  
  // Find the confidence score for the selected classification
  const classificationObj = classifierResult.find(c => c.label === mlSentiment);
  const confidence = classificationObj ? classificationObj.value : 0.5;
  
  // 3. Combine the approaches
  // Normalize the AFINN score to a range between -1 and 1
  const normalizedScore = sentimentResult.comparative;
  
  let finalSentiment;
  if (normalizedScore > 0.2) {
    finalSentiment = 'positive';
  } else if (normalizedScore < -0.2) {
    finalSentiment = 'negative';
  } else {
    // If dictionary score is neutral, rely more on ML classification
    if (Math.abs(normalizedScore) < 0.1 && confidence > 0.6) {
      finalSentiment = mlSentiment;
    } else {
      finalSentiment = 'neutral';
    }
  }
  
  // Calculate a final score between -1 and 1
  let finalScore;
  if (finalSentiment === 'positive') {
    finalScore = Math.max(0.2, normalizedScore);
  } else if (finalSentiment === 'negative') {
    finalScore = Math.min(-0.2, normalizedScore);
  } else {
    finalScore = normalizedScore;
  }
  
  return {
    sentiment: finalSentiment,
    score: finalScore,
    confidence: confidence,
    details: {
      dictionaryScore: normalizedScore,
      mlSentiment: mlSentiment,
      wordCounts: {
        positive: sentimentResult.positive.length,
        negative: sentimentResult.negative.length
      },
      tokens: tokenizer.tokenize(lowerText)
    }
  };
}

module.exports = {
  analyzeSentiment,
  trainClassifier,
  // Add additional classifiers to the public API
  addPositiveExample: (text) => classifier.addDocument(text, 'positive'),
  addNegativeExample: (text) => classifier.addDocument(text, 'negative'),
  addNeutralExample: (text) => classifier.addDocument(text, 'neutral'),
  retrainClassifier: () => classifier.train()
};