import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import './index.css';
import { ApiProvider } from './context/ApiContext';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#a855f7',
          colorBackground: '#09090b',
        }
      }}
    >
      <ApiProvider>
        <App />
      </ApiProvider>
    </ClerkProvider>
  </React.StrictMode>
);