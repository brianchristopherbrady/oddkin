import type {} from '@oddkin/components/frameworks/react';
import '@oddkin/tokens/css/default.css';
import '@oddkin/components/css/base.css';
import '@oddkin/components/css/layout.css';
import '@oddkin/components/define/card';
import '@oddkin/components/define/input';
import '@oddkin/components/define/checkbox';
import '@oddkin/components/define/button';
import { useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [result, setResult] = useState('');
  const [typed, setTyped] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
  };
  return (
    <main className="odd-stack">
      <odd-card>
        <h1 slot="header">Sign up</h1>
        <form id="signup" className="odd-stack" onSubmit={submit}>
          <odd-input
            name="email"
            label="Email"
            type="email"
            required
            onInput={(event) => setTyped(event.currentTarget.value)}
          ></odd-input>
          <odd-checkbox name="updates" value="yes">
            Send me updates
          </odd-checkbox>
          <odd-button type="submit" appearance="primary">
            Join
          </odd-button>
        </form>
        <p id="typed">{typed}</p>
        <output id="result">{result}</output>
      </odd-card>
    </main>
  );
}

createRoot(document.querySelector('#root')!).render(<App />);
