
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCMe-F5d8J_YzpL2qC3AdI8NX7ELrRVudY",
    authDomain: "healthcareapp-bcdd2.firebaseapp.com",
    projectId: "healthcareapp-bcdd2",
    storageBucket: "healthcareapp-bcdd2.appspot.com",
    messagingSenderId: "561783756315",
    appId: "1:561783756315:web:93ddd130de73701b628abe",
    measurementId: "G-8FTJFBVS3E"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);



export { db };
