import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import * as readline from 'readline';

const firebaseConfig = {
  apiKey: 'AIzaSyBK6tTKblKBaqwRj0zd7tRcNr_7LWrHW_k',
  authDomain: 'voya-43d55.firebaseapp.com',
  projectId: 'voya-43d55',
  storageBucket: 'voya-43d55.firebasestorage.app',
  messagingSenderId: '87454059861',
  appId: '1:87454059861:web:2894a2951fc02f496c33dc',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(q, ans => { rl.close(); r(ans); }));
}

async function main() {
  const email = process.argv[2] || await prompt('Email: ');
  const password = process.argv[3] || await prompt('Password: ');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  await setDoc(doc(db, 'users', uid), {
    uid,
    displayName: cred.user.displayName ?? 'Gabe',
    email,
    country: 'United States',
    homeCurrency: 'USD',
    createdAt: Timestamp.now(),
  });

  console.log(`Profile set: United States / USD for ${email}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
