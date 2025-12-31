/**
 * App - Root component
 */

import React from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import AuthenticityVerifier from './components/AuthenticityVerifier';

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <AuthenticityVerifier />
      </div>
    </ErrorBoundary>
  );
}
