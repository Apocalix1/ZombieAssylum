// Importa i moduli direttamente dal pacchetto installato con npm
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection } from "firebase/firestore";

// La configurazione del tuo progetto Zombie Assylum
const firebaseConfig = {
  apiKey: "AIzaSyBrgnHMjzRmHalBHV_xV78kXqGyd1pepcQ",
  authDomain: "zombieassylum-3bc1a.firebaseapp.com",
  projectId: "zombieassylum-3bc1a",
  storageBucket: "zombieassylum-3bc1a.firebasestorage.app",
  messagingSenderId: "318980761186",
  appId: "1:318980761186:web:625a83e1fd9ae9a73d533b",
  measurementId: "G-BJ01C4BLGP"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Esporta le istanze dei servizi e le funzioni utili per gli altri file
export const db = getFirestore(app);
export const auth = getAuth(app);
export { doc, setDoc, getDoc, updateDoc, onSnapshot, collection };

console.log("🔥 [Config] Zombie Assylum connesso a Firebase!");