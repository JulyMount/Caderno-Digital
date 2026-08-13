import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configurações do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBrSpZJO5p9UKXQGXMQPx-_UHsU7h8DGCU",
  authDomain: "meu-caderno-digital-4a5f9.firebaseapp.com",
  projectId: "meu-caderno-digital-4a5f9",
  storageBucket: "meu-caderno-digital-4a5f9.firebasestorage.app",
  messagingSenderId: "803431589266",
  appId: "1:803431589266:web:6e8f6b678e45396b7c8d4b"
};

// Inicializa o aplicativo Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços de Autenticação e Banco de Dados que vamos usar no React
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);