/**
 * App - Root component
 */

import React from 'react';
import AuthenticityVerifier from './components/AuthenticityVerifier';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AuthenticityVerifier />
    </div>
  );
}
