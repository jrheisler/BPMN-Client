# Flow Control Center

Flow Control Center is a browser‑based BPMN modeling and simulation client. It uses [bpmn‑js](https://github.com/bpmn-io/bpmn-js) for diagram editing and Firebase for authentication and storage. Diagrams can be simulated token by token and saved along with notes and version history.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure Firebase**
   Create `public/js/firebase.js` and initialize Firebase with your project credentials:
   ```js
   // public/js/firebase.js
   const firebaseConfig = { /* your config */ };
   firebase.initializeApp(firebaseConfig);
   const db = firebase.firestore();
   ```
3. **Serve the app**
   Serve the `public/` directory using your preferred static server (e.g. `npx http-server public` or `firebase serve`).
4. **Run tests** *(optional but recommended)*
   ```bash
   node --test
   ```

## Saving diagrams and notes

1. Log in via the in‑app dialog.
2. Create or open a diagram.
3. Click the **💾 Save** button.
4. Provide a diagram name and optional notes when prompted.
5. Each save stores a new version in Firestore, preserving the diagram XML, notes, and add‑on configuration.
6. Use the “Select or New Diagram” option to reload or start fresh.

## Repository structure

- `public/` – front‑end assets and scripts
- `test/` and `tests/` – automated tests using Node's built‑in test runner
- `sample*.bpmn` – example diagrams

## License

This project is licensed under the MIT License.
