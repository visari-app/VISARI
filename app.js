import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

// Configuración oficial de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDqsrygmoi3sZIEEcCn55Kem-H5EsK-4MY",
  authDomain: "visari-ae148.firebaseapp.com",
  projectId: "visari-ae148",
  storageBucket: "visari-ae148.firebasestorage.app",
  messagingSenderId: "786255189281",
  appId: "1:786255189281:web:517eb509c0cf324fbc1a60",
  measurementId: "G-CGXW6Z2WWN"
};

// Inicializar Firebase, Firestore y Auth
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

console.log("¡VISARi conectado a Firebase & Auth con éxito!");

/**
 * VISARi - Visualización Interactiva del Rendimiento Académico
 * Core State & Reactivity Engine
 */

// Initial Seed Data for Instant Realistic Presentation
const DEMO_DATA = {
  user: {
    uid: null,
    ownerUid: null,
    name: "",
    email: "",
    avatar: "",
    country: "",
    university: "",
    career: "",
    phone: "",
    isAuthenticated: false
  },
  subjects: [],
  timeline: [],
  studyRequests: [],
  studyPartners: [],
  team: {
    projectName: "",
    members: [],
    tasks: []
  }
};
/**
 * Reactive Application Store
 */
class VisariStore {
  constructor() {
    this.storageKey = 'visari_state_v1';
    this.listeners = [];
    this.state = this.loadState();
    // Inicializar arreglos para solicitudes y compañeros de estudio
    if (!this.state.studyRequests) {
      this.state.studyRequests = [];
    }
    if (!this.state.studyPartners) {
      this.state.studyPartners = [];
    }

    // Timer state (in-memory for active sessions)
    this.timer = {
      seconds: 0,
      isRunning: false,
      intervalId: null,
      selectedSubjectId: null,
      mode: 'stopwatch' // 'stopwatch' | 'pomodoro'
    };
  }

  // Actualizar la clave según el usuario autenticado
  setUserData(user) {
    if (user && user.email) {
      const userKey = `visari_state_${user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      this.storageKey = userKey;

      const loaded = this.loadState();

      // Vincular datos básicos del usuario de Google
      loaded.user.email = user.email;
      if (user.displayName && (!loaded.user.name || loaded.user.name === "Estudiante")) {
        loaded.user.name = user.displayName;
      }
      if (user.photoURL && !loaded.user.avatar) {
        loaded.user.avatar = user.photoURL;
      }

      this.state = loaded;
      this.saveState();
      this.notify();
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.user) parsed.user = { name: '', subjects: [], stats: {} };
        return parsed;
      }
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
    }
    // Si no hay datos guardados para este usuario, retorna el estado base en cero
    return JSON.parse(JSON.stringify(DEMO_DATA));
  }

  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.error("Could not save to localStorage:", e);
    }
    this.notify();
  }

  resetToDemo() {
    const prevAuth = this.state.user && this.state.user.isAuthenticated;
    const prevUser = this.state.user;
    this.state = JSON.parse(JSON.stringify(DEMO_DATA));
    if (prevAuth && prevUser && prevUser.uid) {
      // Preserve the authenticated Firebase user profile
      this.state.user = { ...prevUser };
    } else {
      // Demo guest mode
      this.state.user.name = "Veron Mariano (Demo)";
      this.state.user.email = "veronmarianountref1@gmail.com";
      this.state.user.avatar = "RETRATO MARIANO.png";
      this.state.user.isAuthenticated = true;
    }
    this.saveState();
    this.showToast("🪄 ¡Datos demo cargados con éxito! 4 materias, tareas y horas listas para explorar.");
    this.triggerConfetti();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("Listener error:", err);
      }
    }
  }

  // --- Calculations Engine ---
  getSubjectProgress(subject) {
    if (!subject.tasks || subject.tasks.length === 0) return 0;
    const completed = subject.tasks.filter(t => t.completed).length;
    return Math.round((completed / subject.tasks.length) * 100);
  }

  getGlobalMetrics() {
    const subjects = this.state.subjects || [];
    let totalTasks = 0;
    let completedTasks = 0;
    let totalMinutes = 0;
    let gradedSum = 0;
    let gradedCount = 0;
    const upcomingExams = [];

    const todayStr = new Date().toISOString().split('T')[0];

    subjects.forEach(sub => {
      totalMinutes += (sub.studyMinutes || 0);
      (sub.tasks || []).forEach(task => {
        totalTasks++;
        if (task.completed) {
          completedTasks++;
          if (task.grade !== null && task.grade !== undefined) {
            gradedSum += task.grade;
            gradedCount++;
          }
        } else {
          if (task.type === 'parcial' || task.type === 'final') {
            upcomingExams.push({
              ...task,
              subjectName: sub.name,
              subjectCode: sub.code,
              subjectColor: sub.accent || '#8B5CF6'
            });
          }
        }
      });
    });

    // Sort upcoming exams chronologically
    upcomingExams.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const globalProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const gpa = gradedCount > 0 ? (gradedSum / gradedCount).toFixed(1) : "8.8";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formattedHours = `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`;

    return {
      globalProgress,
      totalTasks,
      completedTasks,
      totalMinutes,
      formattedHours,
      gpa,
      upcomingExams,
      subjectsCount: subjects.length
    };
  }

  // --- User Profile Actions ---
  updateUser(userData) {
    this.state.user = { ...this.state.user, ...userData };
    this.saveState();
    this.showToast("Perfil actualizado correctamente");
  }

  // --- Subjects Actions ---
  async addSubject(subjectData) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      this.showToast("Iniciá sesión para crear una materia.");
      return;
    }

    const newSubject = {
      ownerUid: currentUser.uid,
      id: 'sub-' + Date.now(),
      code: subjectData.code || 'MAT-101',
      name: subjectData.name || 'Nueva Asignatura',
      color: subjectData.color || 'from-violet-600 to-indigo-600',
      accent: subjectData.accent || '#8b5cf6',
      professor: subjectData.professor || 'Profesor Titular',
      credits: Number(subjectData.credits) || 4,
      targetGrade: Number(subjectData.targetGrade) || 8.0,
      studyMinutes: 0,
      tasks: [],
      createdAt: new Date().toISOString()
    };

    try {
      // Guardar la materia en Firebase usando su mismo ID.
      await setDoc(
        doc(db, "subjects", newSubject.id),
        newSubject
      );

      // Incorporar la materia al estado local.
      this.state.subjects.push(newSubject);
      this.saveState();

      this.showToast(`Materia "${newSubject.name}" agregada con éxito`);

      return true;

    } catch (error) {
      console.error("Error guardando la materia en Firebase:", error);
      this.showToast("No se pudo guardar la materia. Revisá la conexión.");
      return false;
    }
  }

  deleteSubject(subjectId) {
    this.state.subjects = this.state.subjects.filter(s => s.id !== subjectId);
    this.saveState();
    this.showToast("Materia eliminada");
  }

  toggleTask(subjectId, taskId) {
    const subject = this.state.subjects.find(s => s.id === subjectId);
    if (!subject) return;
    const task = subject.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;

    // Check if whole subject reached 100%
    const progress = this.getSubjectProgress(subject);
    if (task.completed && progress === 100) {
      this.triggerConfetti();
      this.showToast(`🎉 ¡Felicitaciones! Has completado el 100% de actividades en ${subject.name}`);
    } else if (task.completed) {
      this.showToast(`Actividad marcada como completada: ${task.title}`);
    }

    this.saveState();
  }

  addTask(subjectId, taskData) {
    const subject = this.state.subjects.find(s => s.id === subjectId);
    if (!subject) return;

    const newTask = {
      id: 't-' + Date.now(),
      subjectId: subjectId,
      title: taskData.title || 'Nueva actividad',
      type: taskData.type || 'tarea',
      dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      weight: Number(taskData.weight) || 10,
      completed: false,
      grade: null
    };

    subject.tasks.push(newTask);

    this.saveState();
    this.showToast("Actividad agregada a " + subject.name);
  }
  deleteTask(subjectId, taskId) {
    const subject = this.state.subjects.find(s => s.id === subjectId);
    if (!subject) return;
    subject.tasks = subject.tasks.filter(t => t.id !== taskId);
    this.saveState();
    this.showToast("Actividad eliminada");
  }

  addStudyTime(subjectId, minutes) {
    const subject = this.state.subjects.find(s => s.id === subjectId);
    if (!subject) return;

    // Mantener el acumulado histórico de la materia
    subject.studyMinutes = (subject.studyMinutes || 0) + minutes;

    // Crear historial de sesiones si todavía no existe
    if (!this.state.studySessions) {
      this.state.studySessions = [];
    }

    // Registrar la sesión individual
    this.state.studySessions.push({
      id: Date.now().toString(),
      subjectId: subjectId,
      subject: subject.name,
      durationMinutes: minutes,
      date: new Date().toISOString()
    });

    this.saveState();

    this.showToast(`⏱️ Se registraron +${minutes} minutos de estudio en ${subject.name}`);
  }
  // --- Team Actions ---

  async addTeamTask(taskData) {
    const currentUser = auth.currentUser;

    try {
      console.log("📋 Iniciando creación de tarea grupal", {
        tieneUsuario: !!currentUser,
        subjectId: taskData?.subjectId,
        title: taskData?.title
      });

      if (!currentUser) {
        throw new Error("No hay un usuario autenticado.");
      }

      if (!taskData || !taskData.subjectId) {
        throw new Error("La tarea no tiene una materia seleccionada.");
      }

      if (!taskData.title?.trim()) {
        throw new Error("El título de la tarea está vacío.");
      }

      // Identificar al propietario original de la materia.
      let ownerUid = currentUser.uid;

      const membershipQuery = query(
        collection(db, "subject_members"),
        where("subjectId", "==", String(taskData.subjectId)),
        where("memberUid", "==", currentUser.uid)
      );

      const membershipSnapshot = await getDocs(membershipQuery);

      if (!membershipSnapshot.empty) {
        ownerUid = membershipSnapshot.docs[0].data().ownerUid;
      }

      const newTask = {
        title: taskData.title.trim(),
        assigneeId: taskData.assigneeId || "",
        status: "todo",
        priority: taskData.priority || "media",
        dueDate: taskData.dueDate || "",
        ownerUid: ownerUid,
        createdByUid: currentUser.uid,
        subjectId: String(taskData.subjectId),
        createdAt: new Date().toISOString()
      };

      console.log("📤 Datos que se enviarán a Firestore:", newTask);

      const taskRef = await addDoc(
        collection(db, "team_tasks"),
        newTask
      );

      console.log("✅ Tarea guardada en Firestore", {
        documentId: taskRef.id,
        subjectId: newTask.subjectId,
        status: newTask.status
      });

      this.showToast("Tarea guardada correctamente.");

      // El formulario recargará las tareas desde Firestore.
      // No agregamos otra copia al estado local aquí.
      return true;

    } catch (error) {
      console.error("❌ ERROR AL GUARDAR TAREA GRUPAL");
      console.error("Código:", error?.code || "Sin código");
      console.error("Mensaje:", error?.message || error);
      console.error("Nombre:", error?.name);
      console.error("Error completo:", error);
      if (error?.stack) {
        console.error("Traza:", error.stack);
      }

      const code = error?.code || "";
      let message = "No se pudo guardar la tarea. Revisá la consola.";

      if (code === "permission-denied") {
        message = "Firebase rechazó el permiso para guardar la tarea.";
      } else if (code === "unauthenticated") {
        message = "Tu sesión no está autenticada. Volvé a iniciar sesión.";
      } else if (code === "unavailable") {
        message = "Firebase no está disponible. Revisá tu conexión.";
      } else if (code === "failed-precondition") {
        message = "Firebase informó una condición previa que impide guardar.";
      }

      this.showToast(message);
      return false;
    }
  }

  // --- Procesar formulario de tarea grupal ---

  async handleNewTeamTaskSubmit(event) {
    event.preventDefault();

    const title =
      document.getElementById("team-task-title")?.value.trim();

    const subjectId =
      document.getElementById("team-subject-select")?.value;

    const assigneeId =
      document.getElementById("team-task-assignee")?.value;

    const priority =
      document.getElementById("team-task-priority")?.value;

    const dueDate =
      document.getElementById("team-task-date")?.value;

    if (!title || !subjectId) {
      this.showToast("Completá el título y seleccioná una materia.");
      return;
    }

    try {
      console.log("🧭 Enviando tarea:", {
        title,
        subjectId,
        assigneeId,
        priority,
        dueDate
      });

      const saved = await this.store.addTeamTask({
        title,
        subjectId,
        assigneeId,
        priority,
        dueDate,
        status: "todo"
      });

      if (saved !== true) {
        console.warn("La tarea no se guardó; se mantiene abierto el modal.");
        return;
      }

      await this.loadTeamTasks(subjectId);

      // Renderizar con el estado que realmente utiliza el tablero.
      this.renderTeam(this.store.state);

      this.closeNewTeamTaskModal();

      console.log("✅ Tablero actualizado correctamente.");

    } catch (error) {
      console.error("❌ Error al procesar o actualizar el Kanban:", error);
      this.showToast("La tarea se guardó o procesó, pero no se pudo actualizar el tablero. Revisá la consola.");
    }
  }

  // --- UI Toast & Confetti Helpers ---
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'flex items-center gap-3 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-2xl border border-violet-500/30 transform transition-all duration-300 translate-y-2 opacity-0';
    toast.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-violet-400 animate-ping"></span>
      <span class="flex-1">${message}</span>
      <button class="text-slate-400 hover:text-white" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 65,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#8B5CF6', '#A78BFA', '#3B82F6', '#10B981', '#F59E0B']
      });
    }
  }
}

// Global Store Instance
window.appStore = new VisariStore();

/**
 * VISARi UI Router & View Controller
 */
class VisariApp {
  constructor() {
    this.store = window.appStore;
    this.currentView = 'landing'; // Starts on landing until onAuthStateChanged validates session
    this.authMode = 'login'; // 'login' | 'register'
    this.selectedSubjectDetail = null;
    this.currentCalendarDate = new Date();
    this.timerTicker = null;

    this.init();
  }

  init() {
    // Subscribe to store updates
    this.store.subscribe(() => {
      this.render();
    });

    this.setupGlobalEvents();
    this.setupFirebaseAuth();
    this.render();
  }

  setupGlobalEvents() {
    // Top Bar Botón V quick-trigger
    const topBarBtnB = document.getElementById('topbar-btn-b');
    if (topBarBtnB) {
      topBarBtnB.addEventListener('click', () => {
        this.navigateTo('timer');
      });
    }

    // Demo Data Floating Button
    const demoBtn = document.getElementById('floating-demo-btn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        this.store.resetToDemo();
      });
    }
  }

  // ==========================================
  // FIREBASE AUTHENTICATION & STATE ENGINE
  // ==========================================
  setupFirebaseAuth() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("Firebase Auth State Changed: User Active", firebaseUser.email);
        await this.handleUserAuthenticated(firebaseUser);
      } else {
        console.log("Firebase Auth State Changed: No User Active");
        this.handleUserSignedOut();
      }
    });
  }
  async syncMySubjectsToFirebase(uid) {
    if (!uid) return;

    const subjects = Array.isArray(this.store?.state?.subjects)
      ? this.store.state.subjects
      : [];

    try {
      for (const subject of subjects) {
        if (!subject || !subject.id) continue;

        // No migrar materias que pertenecen a otro usuario.
        if (subject.ownerUid && subject.ownerUid !== uid) continue;

        const subjectRef = doc(db, "subjects", String(subject.id));
        const subjectSnap = await getDoc(subjectRef);

        // Crear el documento solamente si todavía no existe.
        if (!subjectSnap.exists()) {
          await setDoc(subjectRef, {
            ...subject,
            id: String(subject.id),
            ownerUid: uid,
            createdAt: subject.createdAt || new Date().toISOString()
          });
        }
      }

      console.log("Materias propias sincronizadas con Firebase.");

    } catch (error) {
      console.error("Error sincronizando materias:", error);
    }
  }
  async loadSharedSubjectsFromFirebase(uid) {
    if (!uid) return;

    try {
      const membershipQuery = query(
        collection(db, "subject_members"),
        where("memberUid", "==", uid)
      );

      const membershipSnapshot = await getDocs(membershipQuery);

      const ownSubjects = this.store.state.subjects || [];
      const sharedSubjects = [];

      for (const membershipDoc of membershipSnapshot.docs) {
        const membership = membershipDoc.data();

        const subjectId = String(membership.subjectId);

        // Si ya es una materia propia con el mismo ID,
        // no necesitamos agregarla nuevamente.
        if (ownSubjects.some(subject =>
          String(subject.id) === subjectId
        )) {
          continue;
        }

        const subjectRef = doc(db, "subjects", subjectId);
        const subjectSnap = await getDoc(subjectRef);

        if (!subjectSnap.exists()) {
          console.warn("No se encontró la materia:", subjectId);
          continue;
        }

        const firebaseSubject = subjectSnap.data();

        sharedSubjects.push({
          id: subjectId,
          code: firebaseSubject.code || '',
          name: firebaseSubject.name || 'Materia compartida',
          color: firebaseSubject.color || 'from-violet-600 to-indigo-600',
          accent: firebaseSubject.accent || '#8b5cf6',
          professor: firebaseSubject.professor || '',
          credits: firebaseSubject.credits || 0,
          targetGrade: firebaseSubject.targetGrade || 8,
          isShared: true,
          sharedOwnerUid: membership.ownerUid
        });
      }

      // Guardar las materias compartidas por separado.
      this.store.state.sharedSubjects = sharedSubjects;

      this.store.saveState();

      console.log("Materias propias:", ownSubjects);
      console.log("Materias compartidas:", sharedSubjects);

    } catch (error) {
      console.error("Error cargando materias compartidas:", error);
    }
  }
  async handleUserAuthenticated(firebaseUser) {
    // Cargar el estado local correspondiente a este usuario.
    this.store.setUserData(firebaseUser);
    await this.syncMySubjectsToFirebase(firebaseUser.uid);
    await this.loadSharedSubjectsFromFirebase(firebaseUser.uid);
    const userDocRef = doc(db, "users", firebaseUser.uid);

    // Perfil vacío para una cuenta que todavía no guardó sus datos.
    let profileData = {
      uid: firebaseUser.uid,
      ownerUid: firebaseUser.uid,
      name: "",
      email: firebaseUser.email || "",
      avatar: "",
      country: "",
      university: "",
      career: "",
      phone: ""
    };

    try {
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const savedProfile = userSnap.data();

        // Evitar cargar un perfil que no corresponda al usuario.
        if (
          savedProfile.ownerUid &&
          savedProfile.ownerUid !== firebaseUser.uid
        ) {
          throw new Error("El perfil no pertenece al usuario autenticado.");
        }

        profileData = {
          ...profileData,
          ...savedProfile,
          uid: firebaseUser.uid,
          ownerUid: firebaseUser.uid,
          email: firebaseUser.email || savedProfile.email || ""
        };
      }
    } catch (err) {
      console.error("Error al cargar el perfil desde Firestore:", err);
    }

    // No completar nombre, universidad, carrera ni avatar automáticamente.
    this.store.state.user = {
      ...this.store.state.user,
      ...profileData,
      uid: firebaseUser.uid,
      ownerUid: firebaseUser.uid,
      isAuthenticated: true
    };

    this.store.saveState();

    if (this.currentView === "landing") {
      this.currentView = "dashboard";
    }

    this.render();
  }

  handleUserSignedOut() {
    this.store.state.user.isAuthenticated = false;
    this.store.state.user.uid = null;
    this.store.state.user.email = "";
    this.store.saveState();

    this.currentView = 'landing';
    this.render();
  }

  async loginWithGoogle() {
    this.setAuthLoading(true);
    this.hideAuthAlert();
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      this.store.showToast(`✅ ¡Bienvenido/a, ${user.displayName || user.email}!`);
    } catch (error) {
      console.error("Error al iniciar sesión con Google:", error);
      this.showAuthError(this.mapAuthError(error.code));
    } finally {
      this.setAuthLoading(false);
    }
  }

  async loginWithEmail(email, password) {
    this.setAuthLoading(true);
    this.hideAuthAlert();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      this.store.showToast(`✅ ¡Bienvenido/a, ${user.displayName || user.email}!`);
    } catch (error) {
      console.error("Error al iniciar sesión con correo:", error);
      this.showAuthError(this.mapAuthError(error.code));
    } finally {
      this.setAuthLoading(false);
    }
  }

  async registerWithEmail(name, email, password) {
    this.setAuthLoading(true);
    this.hideAuthAlert();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const chosenName = name.trim() || email.split('@')[0];
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(chosenName)}&background=7c3aed&color=fff`;

      try {
        await updateProfile(user, {
          displayName: chosenName,
          photoURL: avatarUrl
        });
      } catch (profErr) {
        console.warn("Could not set displayName on Auth user:", profErr);
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          name: chosenName,
          email: email,
          avatar: avatarUrl,
          country: "Argentina",
          university: "UNTREF VIRTUAL",
          career: "Licenciatura en Producción Audiovisual",
          phone: "",
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (storeErr) {
        console.warn("Firestore setDoc on registration:", storeErr);
      }

      this.store.showToast(`🎉 ¡Cuenta creada con éxito! Bienvenido/a a VISARi, ${chosenName}`);
    } catch (error) {
      console.error("Error al registrar cuenta:", error);
      this.showAuthError(this.mapAuthError(error.code));
    } finally {
      this.setAuthLoading(false);
    }
  }

  async logout() {
    try {
      await signOut(auth);
      this.store.state.user.isAuthenticated = false;
      this.store.state.user.uid = null;
      this.store.state.user.email = "";
      this.store.saveState();
      this.navigateTo('landing');
      this.store.showToast("👋 Has cerrado sesión correctamente.");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      this.store.showToast("Error al cerrar sesión: " + error.message);
    }
  }

  mapAuthError(code) {
    switch (code) {
      case 'auth/invalid-email':
        return 'El formato del correo electrónico no es válido.';
      case 'auth/user-disabled':
        return 'Esta cuenta ha sido inhabilitada por el administrador.';
      case 'auth/user-not-found':
        return 'No existe ninguna cuenta registrada con este correo.';
      case 'auth/wrong-password':
        return 'La contraseña es incorrecta. Inténtalo de nuevo.';
      case 'auth/invalid-credential':
        return 'Credenciales inválidas. Verifica tu correo y contraseña.';
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con este correo. Cambia a "Iniciar Sesión".';
      case 'auth/weak-password':
        return 'La contraseña es muy débil. Debe tener al menos 6 caracteres.';
      case 'auth/popup-closed-by-user':
        return 'Has cancelado o cerrado la ventana de inicio de Google.';
      case 'auth/popup-blocked':
        return 'El navegador bloqueó la ventana emergente de Google. Habilita las ventanas emergentes.';
      case 'auth/network-request-failed':
        return 'Error de conexión. Verifica tu conexión a Internet.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Por seguridad, espera unos momentos.';
      default:
        return 'Error de autenticación (' + (code || 'desconocido') + '). Intenta nuevamente.';
    }
  }

  setAuthMode(mode) {
    this.authMode = mode;
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const nameContainer = document.getElementById('auth-name-container');
    const title = document.getElementById('auth-card-title');
    const subtitle = document.getElementById('auth-card-subtitle');
    const submitText = document.getElementById('auth-submit-text');
    const pwdHint = document.getElementById('auth-pwd-hint');
    const toggleMsg = document.getElementById('auth-toggle-msg');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const pwdInput = document.getElementById('auth-password');
    const nameInput = document.getElementById('auth-name');

    this.hideAuthAlert();

    if (mode === 'register') {
      if (tabLogin) tabLogin.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition duration-200 text-slate-400 hover:text-white cursor-pointer';
      if (tabRegister) tabRegister.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition duration-200 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md cursor-pointer';
      if (nameContainer) nameContainer.classList.remove('hidden');
      if (nameInput) nameInput.required = true;
      if (title) title.textContent = 'Crea tu Cuenta';
      if (subtitle) subtitle.textContent = 'Comienza a potenciar tu rendimiento académico hoy';
      if (submitText) submitText.textContent = 'Crear Cuenta en VISARi →';
      if (pwdHint) pwdHint.classList.remove('hidden');
      if (toggleMsg) toggleMsg.textContent = '¿Ya tienes una cuenta registrada?';
      if (toggleBtn) toggleBtn.textContent = 'Inicia sesión aquí';
      if (pwdInput) pwdInput.setAttribute('autocomplete', 'new-password');
    } else {
      if (tabLogin) tabLogin.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition duration-200 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md cursor-pointer';
      if (tabRegister) tabRegister.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition duration-200 text-slate-400 hover:text-white cursor-pointer';
      if (nameContainer) nameContainer.classList.add('hidden');
      if (nameInput) nameInput.required = false;
      if (title) title.textContent = 'Ingresa a tu Campus';
      if (subtitle) subtitle.textContent = 'Accede con tu cuenta institucional o Google Workspace';
      if (submitText) submitText.textContent = 'Ingresar al Dashboard →';
      if (pwdHint) pwdHint.classList.add('hidden');
      if (toggleMsg) toggleMsg.textContent = '¿No tienes una cuenta aún?';
      if (toggleBtn) toggleBtn.textContent = 'Regístrate aquí';
      if (pwdInput) pwdInput.setAttribute('autocomplete', 'current-password');
    }
  }

  showAuthError(message) {
    const alertBox = document.getElementById('auth-alert');
    const alertMsg = document.getElementById('auth-alert-message');
    const alertIcon = document.getElementById('auth-alert-icon');
    if (alertBox && alertMsg) {
      alertBox.className = 'mb-4 p-3 rounded-xl text-xs font-medium border flex items-start gap-2.5 transition duration-200 bg-rose-500/15 border-rose-500/40 text-rose-300';
      if (alertIcon) alertIcon.textContent = '⚠️';
      alertMsg.textContent = message;
      alertBox.classList.remove('hidden');
    }
  }

  hideAuthAlert() {
    const alertBox = document.getElementById('auth-alert');
    if (alertBox) alertBox.classList.add('hidden');
  }

  setAuthLoading(isLoading) {
    const submitBtn = document.getElementById('auth-submit-btn');
    const googleBtn = document.getElementById('btn-google-auth');
    const spinner = document.getElementById('auth-submit-spinner');
    if (submitBtn) submitBtn.disabled = isLoading;
    if (googleBtn) googleBtn.disabled = isLoading;
    if (spinner) {
      if (isLoading) spinner.classList.remove('hidden');
      else spinner.classList.add('hidden');
    }
  }

  navigateTo(view, payload = null) {
    if (!this.store.state.user.isAuthenticated && view !== 'landing') {
      this.currentView = 'landing';
      this.render();
      return;
    }
    this.currentView = view;
    if (view === 'materia-detail' && payload) {
      this.selectedSubjectDetail = payload;
    }

    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  render() {
    const state = this.store.state;

    // Check auth view vs app view
    const landingView = document.getElementById('view-landing');
    const appShell = document.getElementById('app-shell');

    if (this.currentView === 'landing' || !state.user.isAuthenticated) {
      if (landingView) landingView.classList.remove('hidden');
      if (appShell) appShell.classList.add('hidden');
      this.renderLanding();
      return;
    } else {
      if (landingView) landingView.classList.add('hidden');
      if (appShell) appShell.classList.remove('hidden');
    }

    // Update global layout indicators (Sidebar active item, User Avatar, Timer badge)
    this.updateShell(state);

    // Hide all view panels
    const views = ['dashboard', 'materias', 'materia-detail', 'timer', 'calendar', 'team', 'profile'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        if (v === this.currentView) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });

    // Render specific view
    switch (this.currentView) {
      case 'dashboard':
        this.renderDashboard(state);
        break;
      case 'materias':
        this.renderMaterias(state);
        break;
      case 'materia-detail':
        this.renderMateriaDetail(state);
        break;
      case 'timer':
        this.renderTimerView(state);
        break;
      case 'calendar':
        this.renderCalendar(state);
        break;
      case 'team':
        this.renderTeam(state);
        break;
      case 'profile':
        this.renderProfile(state);
        break;
      default:
        this.renderDashboard(state);
    }

    // Reinitialize icons if lucide is loaded
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  updateShell(state) {
    // Update user info in header and sidebar
    const userNames = document.querySelectorAll('.user-display-name');
    userNames.forEach(el => el.textContent = state.user.name || 'Estudiante');

    const userCareers = document.querySelectorAll('.user-display-career');
    userCareers.forEach(el => el.textContent = state.user.career || 'Estudiante Universitario');

    const userAvatars = document.querySelectorAll('.user-display-avatar');
    userAvatars.forEach(el => {
      if (el.tagName === 'IMG') {
        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.name || 'Estudiante')}&background=7c3aed&color=fff`;
        el.src = state.user.avatar || fallbackUrl;
        el.onerror = () => {
          el.src = fallbackUrl;
        };
      }
    });

    // Update Sidebar Navigation highlights
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const target = item.getAttribute('data-target');
      if (target === this.currentView || (this.currentView === 'materia-detail' && target === 'materias')) {
        item.classList.add('bg-violet-600/10', 'text-violet-600', 'font-semibold', 'border-l-4', 'border-violet-600');
        item.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        item.classList.remove('bg-violet-600/10', 'text-violet-600', 'font-semibold', 'border-l-4', 'border-violet-600');
        item.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    });

    // Top Bar Timer Widget Status
    const timerStatus = document.getElementById('topbar-timer-status');
    const timerDisplay = document.getElementById('topbar-timer-display');
    if (timerStatus && timerDisplay) {
      if (this.store.timer.isRunning) {
        timerStatus.classList.remove('hidden');
        timerStatus.classList.add('flex');
        timerDisplay.textContent = this.formatSeconds(this.store.timer.seconds);
      } else {
        timerStatus.classList.add('hidden');
        timerStatus.classList.remove('flex');
      }
    }
  }

  // ==========================================
  // VIEW 1: LANDING & AUTH
  // ==========================================
  renderLanding() {
    const form = document.getElementById('auth-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('auth-email');
        const pwdInput = document.getElementById('auth-password');
        const nameInput = document.getElementById('auth-name');

        const email = emailInput ? emailInput.value.trim() : '';
        const password = pwdInput ? pwdInput.value : '';
        const name = nameInput ? nameInput.value.trim() : '';

        if (!email || !password) {
          this.showAuthError('Por favor completa todos los campos requeridos.');
          return;
        }

        if (this.authMode === 'register') {
          await this.registerWithEmail(name, email, password);
        } else {
          await this.loginWithEmail(email, password);
        }
      };
    }

    const googleBtn = document.getElementById('btn-google-auth');
    if (googleBtn) {
      googleBtn.onclick = () => {
        this.loginWithGoogle();
      };
    }

    const tabLogin = document.getElementById('auth-tab-login');
    if (tabLogin) {
      tabLogin.onclick = () => this.setAuthMode('login');
    }

    const tabRegister = document.getElementById('auth-tab-register');
    if (tabRegister) {
      tabRegister.onclick = () => this.setAuthMode('register');
    }

    const toggleBtn = document.getElementById('auth-toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        this.setAuthMode(this.authMode === 'login' ? 'register' : 'login');
      };
    }

    const demoDirectBtn = document.getElementById('btn-direct-demo');
    if (demoDirectBtn) {
      demoDirectBtn.onclick = () => {
        this.store.resetToDemo();
        this.navigateTo('dashboard');
      };
    }
  }

  // ==========================================
  // VIEW 2: PROFILE
  // ==========================================
  renderProfile(state) {
    const user = state.user;

    const nameInput = document.getElementById('profile-name');
    const avatarInput = document.getElementById('profile-avatar');
    const countryInput = document.getElementById('profile-country');
    const uniInput = document.getElementById('profile-uni');
    const careerInput = document.getElementById('profile-career');
    const phoneInput = document.getElementById('profile-phone');
    const emailDisplay = document.getElementById('profile-email');

    if (nameInput) nameInput.value = user.name || '';
    if (avatarInput) avatarInput.value = user.avatar || '';
    if (countryInput) countryInput.value = user.country || '';
    if (uniInput) uniInput.value = user.university || '';
    if (careerInput) careerInput.value = user.career || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (emailDisplay) {
      emailDisplay.textContent = user.email || 'Sin correo asociado';
    }

    // Contadores del perfil
    const metrics = this.store.getGlobalMetrics();
    const countSubjects = document.getElementById('profile-stat-subjects');
    const countHours = document.getElementById('profile-stat-hours');
    const countGpa = document.getElementById('profile-stat-gpa');

    if (countSubjects) countSubjects.textContent = metrics.subjectsCount;
    if (countHours) countHours.textContent = metrics.formattedHours;
    if (countGpa) countGpa.textContent = metrics.gpa;

    // Actualizar los avatares en toda la aplicación
    const syncAvatars = (imageUrl) => {
      const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Estudiante')}&background=7c3aed&color=fff`;
      const targetUrl = imageUrl && imageUrl.trim()
        ? imageUrl.trim()
        : fallback;

      const previewImg = document.getElementById('profile-avatar-preview');
      if (previewImg) previewImg.src = targetUrl;

      const allAvatars = document.querySelectorAll('.user-display-avatar');

      allAvatars.forEach((img) => {
        if (img.tagName === 'IMG') {
          img.src = targetUrl;
        }
      });
    };

    // Actualización del avatar al escribir o pegar una URL
    if (avatarInput) {
      avatarInput.oninput = (e) => {
        const val = e.target.value.trim();

        syncAvatars(val);

        document.querySelectorAll('.avatar-preset-btn').forEach((btn) => {
          if (btn.getAttribute('data-url') === val) {
            btn.classList.add(
              'border-violet-600',
              'ring-2',
              'ring-violet-400'
            );
            btn.classList.remove('border-transparent');
          } else {
            btn.classList.remove(
              'border-violet-600',
              'ring-2',
              'ring-violet-400'
            );
            btn.classList.add('border-transparent');
          }
        });
      };
    }

    // Subir una imagen desde la computadora
    const fileInput = document.getElementById('profile-avatar-file');

    if (fileInput) {
      fileInput.onchange = (e) => {
        const file = e.target.files && e.target.files[0];

        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
          this.store.showToast(
            '⚠️ La imagen seleccionada es mayor a 3MB. Se recomienda una imagen más ligera.'
          );
        }

        const reader = new FileReader();

        reader.onload = (loadEvent) => {
          const base64Data = loadEvent.target.result;

          if (avatarInput) {
            avatarInput.value = base64Data;
          }

          syncAvatars(base64Data);

          const statusEl = document.getElementById('file-upload-status');

          if (statusEl) {
            statusEl.textContent = `✓ ${file.name.slice(0, 16)}...`;
            statusEl.classList.remove('text-slate-400');
            statusEl.classList.add('text-emerald-600', 'font-semibold');
          }

          document.querySelectorAll('.avatar-preset-btn').forEach((btn) => {
            btn.classList.remove(
              'border-violet-600',
              'ring-2',
              'ring-violet-400'
            );
            btn.classList.add('border-transparent');
          });

          this.store.showToast(
            "📷 Imagen procesada correctamente. Haz clic en 'Guardar Cambios' para conservarla."
          );
        };

        reader.readAsDataURL(file);
      };
    }

    // Selección de avatares predeterminados
    const avatarPresets = document.querySelectorAll('.avatar-preset-btn');

    avatarPresets.forEach((btn) => {
      const url = btn.getAttribute('data-url');

      if (user.avatar === url) {
        btn.classList.add(
          'border-violet-600',
          'ring-2',
          'ring-violet-400'
        );
        btn.classList.remove('border-transparent');
      } else {
        btn.classList.remove(
          'border-violet-600',
          'ring-2',
          'ring-violet-400'
        );
        btn.classList.add('border-transparent');
      }

      btn.onclick = () => {
        if (avatarInput) {
          avatarInput.value = url;
        }

        syncAvatars(url);

        avatarPresets.forEach((preset) => {
          preset.classList.remove(
            'border-violet-600',
            'ring-2',
            'ring-violet-400'
          );
          preset.classList.add('border-transparent');
        });

        btn.classList.add(
          'border-violet-600',
          'ring-2',
          'ring-violet-400'
        );
        btn.classList.remove('border-transparent');

        const statusEl = document.getElementById('file-upload-status');

        if (statusEl) {
          statusEl.textContent = 'Preset seleccionado';
          statusEl.classList.remove('text-emerald-600', 'font-semibold');
          statusEl.classList.add('text-slate-400');
        }
      };
    });

    // Guardar el formulario del perfil
    const profileForm = document.getElementById('profile-form');

    if (profileForm) {
      profileForm.onsubmit = async (e) => {
        e.preventDefault();

        const currentUser = auth.currentUser;

        if (!currentUser) {
          this.store.showToast(
            'Debés iniciar sesión para guardar tu perfil.'
          );
          return;
        }

        const updatedData = {
          ownerUid: currentUser.uid,
          uid: currentUser.uid,
          email: currentUser.email || '',
          name: nameInput ? nameInput.value.trim() : '',
          avatar: avatarInput ? avatarInput.value.trim() : '',
          country: countryInput ? countryInput.value.trim() : '',
          university: uniInput ? uniInput.value.trim() : '',
          career: careerInput ? careerInput.value.trim() : '',
          phone: phoneInput ? phoneInput.value.trim() : ''
        };

        // Primero, guardar los datos en Firestore
        try {
          await setDoc(
            doc(db, 'users', currentUser.uid),
            updatedData,
            { merge: true }
          );
        } catch (err) {
          console.error('Error al guardar el perfil en Firestore:', err);

          this.store.showToast(
            'No se pudo guardar el perfil. Intentá nuevamente.'
          );
          return;
        }

        // Actualizar el estado local después de guardar correctamente
        this.store.updateUser(updatedData);

        // Actualizar el perfil de Firebase Authentication
        try {
          await updateProfile(currentUser, {
            displayName: updatedData.name || '',
            photoURL: updatedData.avatar.startsWith('http')
              ? updatedData.avatar
              : null
          });
        } catch (err) {
          console.warn(
            'No se pudo actualizar el perfil de Firebase Authentication:',
            err
          );
        }

        this.store.showToast('Perfil guardado correctamente.');
      };
    }
  }


  // ==========================================
  // VIEW 3: DASHBOARD GENERAL
  // ==========================================
  renderDashboard(state) {
    const metrics = this.store.getGlobalMetrics();

    // Top Metrics
    const gpaEl = document.getElementById('dash-gpa');
    const hoursEl = document.getElementById('dash-hours');
    const progressEl = document.getElementById('dash-progress');
    const progressFill = document.getElementById('dash-progress-bar');
    const examsCountEl = document.getElementById('dash-exams-count');

    if (gpaEl) gpaEl.textContent = metrics.gpa + " / 10";
    if (hoursEl) hoursEl.textContent = metrics.formattedHours;
    if (progressEl) progressEl.textContent = `${metrics.globalProgress}% (${metrics.completedTasks}/${metrics.totalTasks} tareas)`;
    if (progressFill) progressFill.style.width = `${metrics.globalProgress}%`;
    if (examsCountEl) {
      examsCountEl.textContent = metrics.upcomingExams.length > 0
        ? `${metrics.upcomingExams.length} programados`
        : "Sin exámenes próximos";
    }

    // =====================================
    // RESUMEN SEMANAL (LUNES A DOMINGO)
    // =====================================
    const weeklySection = document.getElementById('dashboard-weekly-summary');
    if (weeklySection) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

      const monday = new Date(now.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      // 1. SESIONES DE ESTUDIO DE LA SEMANA
      const studySessions = this.state?.studySessions || state.studySessions || [];

      const weeklySessions = studySessions.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= monday && sessionDate <= sunday;
      });

      // 2. SUMAR MINUTOS
      const totalWeeklyMinutes = weeklySessions.reduce((total, session) => {
        return total + Number(session.durationMinutes || session.minutes || 0);
      }, 0);

      // 3. FORMATO HORAS Y MINUTOS
      const weeklyHours = Math.floor(totalWeeklyMinutes / 60);
      const weeklyMinutes = totalWeeklyMinutes % 60;

      const formattedWeeklyTime = `${weeklyHours} h ${weeklyMinutes} min`;

      // 4. MATERIAS ACTIVAS ESTA SEMANA
      const weeklyHoursBySubject = {};

      // Contar materias donde se registró tiempo de estudio
      weeklySessions.forEach(session => {
        const subjectKey = session.subjectId || session.subject;

        if (subjectKey) {
          weeklyHoursBySubject[subjectKey] = true;
        }
      });

      // Contar también materias donde se crearon actividades esta semana
      (state.subjects || []).forEach(subject => {
        (subject.tasks || []).forEach(task => {
          const taskDate = new Date(task.createdAt || task.dueDate);

          if (
            !isNaN(taskDate.getTime()) &&
            taskDate >= monday &&
            taskDate <= sunday
          ) {
            weeklyHoursBySubject[subject.id] = true;
          }
        });
      });

      // 5. TAREAS PENDIENTES DE LA SEMANA

      const teamTasks = this.store?.state?.team?.tasks || [];

      const personalTasks = state.tasks || [];

      // Actividades personales guardadas dentro de cada materia
      const subjectTasks = (state.subjects || []).flatMap(subject =>
        (subject.tasks || []).map(task => ({
          ...task,
          subjectId: task.subjectId || subject.id
        }))
      );

      // Unificar actividades personales y tareas de equipo
      const allTasks = [
        ...personalTasks,
        ...teamTasks,
        ...subjectTasks
      ];

      // Evitar duplicados por ID
      const uniqueTasks = [
        ...new Map(
          allTasks.map((task, index) => [
            task.id || `${task.title || 'tarea'}-${index}`,
            task
          ])
        ).values()
      ];

      const weeklyPendingTasks = uniqueTasks.filter(task => {

        // Priorizar la fecha de creación
        const rawDate = task.createdAt || task.dueDate || task.date;

        if (!rawDate) return false;

        const taskDate = rawDate.toDate
          ? rawDate.toDate()
          : /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate))
            ? new Date(`${rawDate}T12:00:00`)
            : new Date(rawDate);

        if (isNaN(taskDate.getTime())) return false;

        const isThisWeek =
          taskDate >= monday && taskDate <= sunday;

        const isCompleted =
          task.completed === true ||
          task.status === 'done' ||
          task.status === 'completed';

        return isThisWeek && !isCompleted;

      }).length;
      weeklySection.innerHTML = `
                <div class="p-5 bg-gradient-to-br from-indigo-50/90 via-slate-50 to-violet-50/50 rounded-2xl border border-indigo-100/80 shadow-sm mb-6">
                    <div class="flex items-center justify-between mb-4">
          <div>
                            <h3 class="text-sm font-bold text-indigo-950">Rendimiento Semanal (Lunes a Domingo)</h3>
                            <p class="text-xs text-indigo-700/70">Del ${monday.toLocaleDateString()} al ${sunday.toLocaleDateString()}</p>
         </div>
    <span class="px-2.5 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full shadow-sm">Ciclo Activo</span>
</div>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4">

    <!-- HORAS DE ESTUDIO -->
    <div class="p-3 bg-white/80 backdrop-blur rounded-xl border border-indigo-100/50">
        <span class="text-[11px] font-medium text-slate-500 block mb-1">
            Horas de Estudio Semanal
        </span>
        <span class="text-lg font-bold text-indigo-900">
            ${formattedWeeklyTime}
        </span>
    </div>

    <!-- MATERIAS ACTIVAS -->
    <div class="p-3 bg-white/80 backdrop-blur rounded-xl border border-indigo-100/50">
        <span class="text-[11px] font-medium text-slate-500 block mb-1">
            Materias Activas esta Semana
        </span>
        <span class="text-lg font-bold text-indigo-900">
            ${Object.keys(weeklyHoursBySubject).length}
        </span>
    </div>

    <!-- TAREAS PENDIENTES -->
    <div class="p-3 bg-white/80 backdrop-blur rounded-xl border border-indigo-100/50">
        <span class="text-[11px] font-medium text-slate-500 block mb-1">
            Tareas / Actividades Pendientes
        </span>
        <span class="text-lg font-bold text-indigo-900">
            ${weeklyPendingTasks}
        </span>
    </div>

</div>
</div>
    `;
    }

    // ... acá continúa el resto de tu código de renderDashboard (como el listado de materias de la línea 1112) ...
    // 4 Main Segments Previews
    // 1. Obtener materias y sesiones de forma segura desde la app o el estado
    const currentSubjects = (this.state && this.state.subjects) ? this.state.subjects : (state && state.subjects) ? state.subjects : [];
    const currentSessions = (this.state && this.state.studySessions) ? this.state.studySessions : (state && state.studySessions) ? state.studySessions : [];

    // 2. Calcular promedio base de materias o por tareas completadas
    let totalScore = 0;
    let scoredCount = 0;
    let totalProgressScore = 0;

    if (currentSubjects.length > 0) {
      currentSubjects.forEach(sub => {
        const grade = sub.grade !== undefined ? Number(sub.grade) : (sub.nota !== undefined ? Number(sub.nota) : NaN);
        if (!isNaN(grade)) {
          totalScore += grade;
          scoredCount++;
        }
        // Contar avance de tareas por materia
        if (sub.tasks && sub.tasks.length > 0) {
          const doneTasks = sub.tasks.filter(t => t.completed).length;
          totalProgressScore += (doneTasks / sub.tasks.length) * 10;
        }
      });
    }

    // Definir nota base (si hay notas usa el promedio, si no, usa el avance de tareas, o un 6.5 inicial)
    let baseAverage = 6.5;
    if (scoredCount > 0) {
      baseAverage = totalScore / scoredCount;
    } else if (currentSubjects.length > 0) {
      baseAverage = totalProgressScore / currentSubjects.length;
      if (baseAverage < 5.0) baseAverage = 6.5;
    }

    // 3. Calcular horas de estudio totales acumuladas o de la semana
    let totalMinutes = 0;
    currentSessions.forEach(ses => {
      totalMinutes += ses.durationMinutes || ses.minutes || 0;
    });
    // Si no hay sesiones en el array global, usa las de la semana calculadas antes
    if (totalMinutes === 0 && typeof weeklyStudyMinutes !== 'undefined') {
      totalMinutes = weeklyStudyMinutes;
    }

    const studyHours = totalMinutes / 60;

    // 4. Bonus por esfuerzo: Cada 1 hora de estudio suma +0.1 al promedio (tope de +2.5)
    const studyBonus = Math.min(2.5, studyHours * 0.1);

    // 5. Promedio final combinado (tope máximo de 10.0)
    let finalAverage = Math.min(10.0, baseAverage + studyBonus);

    // Inyectar en el elemento HTML del GPA
    const gpaElement = document.getElementById('dash-gpa');
    if (gpaElement) {
      gpaElement.textContent = `${finalAverage.toFixed(1)} / 10`;
    }
    this.renderDashboardSegments(state, metrics);
  }

  renderDashboardSegments(state, metrics) {
    // 1. Materias Preview List
    const materiasContainer = document.getElementById('dash-segment-materias');
    if (materiasContainer) {
      if (state.subjects.length === 0) {
        materiasContainer.innerHTML = `<p class="text-sm text-slate-500 py-4">No hay materias registradas. ¡Agrega una para comenzar!</p>`;
      } else {
        materiasContainer.innerHTML = state.subjects.slice(0, 3).map(sub => {
          const prog = this.store.getSubjectProgress(sub);
          const completedCount = sub.tasks.filter(t => t.completed).length;
          return `
            <div class="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition border border-slate-200/60 cursor-pointer" onclick="window.visariApp.navigateTo('materia-detail', '${sub.id}')">
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-full" style="background-color: ${sub.accent || '#8B5CF6'}"></span>
                <div>
                  <h4 class="text-sm font-semibold text-slate-900">${sub.name}</h4>
                  <p class="text-xs text-slate-500">${sub.code} • ${completedCount}/${sub.tasks.length} actividades</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div class="h-full bg-violet-600 rounded-full transition-all duration-500" style="width: ${prog}%"></div>
                </div>
                <span class="text-xs font-bold text-slate-700 w-8 text-right">${prog}%</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 2. Cronómetro Botón V Widget
    const timerWidgetBtn = document.getElementById('dash-segment-timer-btn');
    const timerStatusLabel = document.getElementById('dash-timer-status-label');
    if (timerWidgetBtn && timerStatusLabel) {
      if (this.store.timer.isRunning) {
        timerStatusLabel.textContent = `En curso: ${this.formatSeconds(this.store.timer.seconds)}`;
        timerWidgetBtn.innerHTML = `
          <span class="flex items-center gap-2 text-rose-500 font-semibold">
            <span class="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
            Detener & Asignar
          </span>
        `;
        timerWidgetBtn.onclick = () => {
          this.navigateTo('timer');
          this.stopTimerPrompt();
        };
      } else {
        timerStatusLabel.textContent = "Listo para una nueva sesión";
        timerWidgetBtn.innerHTML = `
          <span class="flex items-center gap-2 text-violet-600 font-semibold">
            ⚡ Iniciar Cronómetro
          </span>
        `;
        timerWidgetBtn.onclick = () => {
          this.navigateTo('timer');
        };
      }
    }

    // 3. Calendario Preview (Next upcoming milestones)
    const calContainer = document.getElementById('dash-segment-calendar');
    if (calContainer) {
      if (metrics.upcomingExams.length === 0) {
        calContainer.innerHTML = `<p class="text-sm text-slate-500 py-3">No hay exámenes ni entregas urgentes próximas.</p>`;
      } else {
        calContainer.innerHTML = metrics.upcomingExams.slice(0, 3).map(exam => {
          const typeBadge = exam.type === 'parcial'
            ? '<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">PARCIAL</span>'
            : '<span class="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">FINAL</span>';
          return `
            <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm">
              <div class="flex items-center gap-2.5">
                <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${exam.subjectColor}"></div>
                <div>
                  <p class="text-xs font-bold text-slate-800">${exam.title}</p>
                  <p class="text-[11px] text-slate-500">${exam.subjectName}</p>
                </div>
              </div>
              <div class="text-right flex items-center gap-2">
                ${typeBadge}
                <span class="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                  📅 ${exam.dueDate}
                </span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 4. Team Preview
    const teamContainer = document.getElementById('dash-segment-team');
    if (teamContainer) {
      const activeTasks = state.team.tasks.filter(t => t.status !== 'done');
      const doneCount = state.team.tasks.filter(t => t.status === 'done').length;
      const teamProg = state.team.tasks.length > 0 ? Math.round((doneCount / state.team.tasks.length) * 100) : 0;

      teamContainer.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500">Progreso del sprint grupal</span>
            <span class="text-xs font-bold text-violet-600">${teamProg}% completado</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div class="h-full bg-violet-600 rounded-full transition-all duration-500" style="width: ${teamProg}%"></div>
          </div>
          <div class="flex items-center justify-between pt-1">
            <div class="flex -space-x-2">
              ${state.team.members.map(m => `
                <img src="${m.avatar}" title="${m.name}" class="w-7 h-7 rounded-full border-2 border-white object-cover" />
              `).join('')}
            </div>
            <span class="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              ${activeTasks.length} tareas pendientes
            </span>
          </div>
        </div>
      `;
    }
  }

  // ==========================================
  // VIEW 4: MATERIAS (OVERVIEW & DETAIL)
  // ==========================================
  renderMaterias(state) {
    const grid = document.getElementById('materias-grid');
    if (!grid) return;

    if (state.subjects.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <p class="text-slate-500 font-medium">No has registrado materias aún.</p>
          <button class="mt-4 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition" onclick="window.visariApp.openNewSubjectModal()">
            + Agregar tu primera materia
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = state.subjects.map(subject => {
      const progress = this.store.getSubjectProgress(subject);
      const totalTasks = subject.tasks.length;
      const completedTasks = subject.tasks.filter(t => t.completed).length;
      const hours = Math.floor(subject.studyMinutes / 60);
      const mins = subject.studyMinutes % 60;
      const studyTimeStr = `${hours}h ${mins > 0 ? mins + 'm' : ''}`;

      return `
        <div class="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
          <div>
            <div class="flex items-start justify-between mb-4">
              <span class="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md text-white bg-slate-900">
                ${subject.code}
              </span>
              <div class="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>⏱️ ${studyTimeStr}</span>
              </div>
            </div>

            <h3 class="text-lg font-bold text-slate-900 group-hover:text-violet-600 transition-colors line-clamp-1 mb-1">
              ${subject.name}
            </h3>
            <p class="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
              <span>👤 ${subject.professor}</span>
              <span>•</span>
              <span>${subject.credits} Créditos</span>
            </p>

            <!-- Progress bar -->
            <div class="space-y-1.5 mb-5">
              <div class="flex justify-between text-xs font-semibold">
                <span class="text-slate-600">Avance de Cursada</span>
                <span class="text-violet-600 font-bold">${progress}%</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div class="h-full bg-violet-600 rounded-full transition-all duration-600" style="width: ${progress}%"></div>
              </div>
              <p class="text-[11px] text-slate-400 text-right">${completedTasks} de ${totalTasks} actividades completadas</p>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button class="px-3.5 py-1.5 bg-slate-100 hover:bg-violet-50 hover:text-violet-700 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5" onclick="window.visariApp.navigateTo('materia-detail', '${subject.id}')">
              <span>Ver Tareas & Entregas</span>
              <span>→</span>
            </button>
            <button class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Eliminar Materia" onclick="window.visariApp.confirmDeleteSubject('${subject.id}')">
              🗑️
</button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderMateriaDetail(state) {
    const subject = state.subjects.find(s => s.id === this.selectedSubjectDetail);
    if (!subject) {
      this.navigateTo('materias');
      return;
    }

    const progress = this.store.getSubjectProgress(subject);
    const completedTasks = subject.tasks.filter(t => t.completed).length;
    const hours = Math.floor(subject.studyMinutes / 60);
    const mins = subject.studyMinutes % 60;

    // Header info
    document.getElementById('materia-detail-code').textContent = subject.code;
    document.getElementById('materia-detail-name').textContent = subject.name;
    document.getElementById('materia-detail-prof').textContent = `Profesor: ${subject.professor} • ${subject.credits} Créditos`;
    document.getElementById('materia-detail-hours').textContent = `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
    document.getElementById('materia-detail-progress-num').textContent = `${progress}%`;
    document.getElementById('materia-detail-progress-bar').style.width = `${progress}%`;
    document.getElementById('materia-detail-ratio').textContent = `${completedTasks} de ${subject.tasks.length} actividades completadas`;

    // Tasks list
    const tasksContainer = document.getElementById('materia-detail-tasks');
    if (tasksContainer) {
      if (subject.tasks.length === 0) {
        tasksContainer.innerHTML = `<p class="text-sm text-slate-400 py-6 text-center">No hay actividades creadas para esta materia aún.</p>`;
      } else {
        tasksContainer.innerHTML = subject.tasks.map(task => {
          const typeLabels = {
            tarea: { text: "Tarea", cls: "bg-blue-50 text-blue-700 border-blue-200" },
            entrega: { text: "Entrega TP", cls: "bg-purple-50 text-purple-700 border-purple-200" },
            foro: { text: "Foro / Debate", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            lectura: { text: "📖 Lectura Diaria", cls: "bg-teal-50 text-teal-800 border-teal-300 font-bold" },
            parcial: { text: "Examen Parcial", cls: "bg-amber-50 text-amber-700 border-amber-200" },
            final: { text: "Examen Final", cls: "bg-rose-50 text-rose-700 border-rose-200" }
          };
          const badge = typeLabels[task.type] || typeLabels.tarea;

          return `
                        <div class="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200/80 transition group ${task.completed ? 'opacity-70 bg-slate-50/50' : ''}">
                            <div class="flex items-center gap-3.5">
                                <input 
                                    type="checkbox" 
                                    ${task.completed ? 'checked' : ''} 
                                    class="w-5 h-5 rounded-md text-violet-600 focus:ring-violet-500 border-slate-300 cursor-pointer transition"
                                    onchange="window.visariApp.store.toggleTask('${subject.id}', '${task.id}')"
                                />
                                <div>
                                    <h4 class="text-sm font-semibold text-slate-900 ${task.completed ? 'line-through text-slate-500' : ''}">
                                        ${task.title}
                                    </h4>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}">${badge.text}</span>
                    <span class="text-xs text-slate-400">📅 Límite: ${task.dueDate}</span>
                    ${task.grade ? `<span class="text-xs font-semibold text-emerald-600">Nota: ${task.grade}</span>` : ''}
                  </div>
                                </div>
                            </div>
                            <button 
                                class="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 transition" 
                                title="Eliminar actividad"
                                onclick="window.visariApp.store.deleteTask('${subject.id}', '${task.id}')">
                                ✕
                            </button>
                        </div>
                    `;
        }).join('');
      }
    }

    // Mostrar el foro de la materia seleccionada.
    this.renderSubjectForum(subject.id);
  }

  renderSubjectForum(subjectId) {
    const container = document.getElementById('subject-forum-container');
    const currentUser = auth.currentUser;

    if (!container || !subjectId || !currentUser) return;

    // Cerrar las escuchas anteriores.
    if (this.subjectForumUnsubscribe) {
      this.subjectForumUnsubscribe();
      this.subjectForumUnsubscribe = null;
    }

    if (this.subjectForumCommentsUnsubscribe) {
      this.subjectForumCommentsUnsubscribe();
      this.subjectForumCommentsUnsubscribe = null;
    }

    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 p-5 mt-6">
        <h3 class="text-lg font-bold text-slate-900">Foro de la materia</h3>
        <p class="text-sm text-slate-500 mb-5">
          Creá temas de debate y conversá con tus compañeros.
        </p>

        <form id="subject-forum-form" class="mb-6">
          <input
            id="subject-forum-title"
            required
            maxlength="120"
            placeholder="Título del tema (ej.: Unidad 1)"
            class="w-full border border-slate-200 rounded-xl p-3 text-sm mb-3"
          />

          <textarea
            id="subject-forum-content"
            required
            rows="3"
            placeholder="Escribí la consigna o planteá el tema de debate..."
            class="w-full border border-slate-200 rounded-xl p-3 text-sm"
          ></textarea>

          <div class="flex justify-end mt-3">
            <button
              type="submit"
              class="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            >
              Crear tema
            </button>
          </div>
        </form>

        <div id="subject-forum-posts" class="space-y-5">
          <p class="text-sm text-slate-400 text-center py-5">
            Cargando temas...
          </p>
        </div>
      </div>
    `;

    const postsContainer = document.getElementById('subject-forum-posts');
    const form = document.getElementById('subject-forum-form');

    let ownerUid = currentUser.uid;
    let postsData = [];
    let commentsData = [];

    const getAuthorName = () =>
      currentUser.displayName ||
      (currentUser.email ? currentUser.email.split("@")[0] : "Usuario");

    // Crear un tema nuevo.
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const title = document.getElementById('subject-forum-title').value.trim();
      const content = document.getElementById('subject-forum-content').value.trim();

      if (!title || !content) return;

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = "Publicando...";

      try {
        await addDoc(collection(db, "forum_posts"), {
          subjectId: String(subjectId),
          ownerUid: ownerUid,
          authorUid: currentUser.uid,
          authorName: getAuthorName(),
          authorEmail: currentUser.email || "",
          title: title,
          content: content,
          createdAt: new Date().toISOString()
        });

        form.reset();

      } catch (error) {
        console.error("Error creando tema:", error);
        alert("No se pudo crear el tema.");
      } finally {
        button.disabled = false;
        button.textContent = "Crear tema";
      }
    });

    // Crear un comentario o una respuesta.
    postsContainer.addEventListener('submit', async (event) => {
      const commentForm = event.target.closest('.forum-comment-form');
      if (!commentForm) return;

      event.preventDefault();

      const textarea = commentForm.querySelector('textarea');
      const content = textarea.value.trim();

      if (!content) return;

      const postId = commentForm.dataset.postId;
      const parentCommentId = commentForm.dataset.parentId || null;
      const button = commentForm.querySelector('button[type="submit"]');

      button.disabled = true;

      try {
        await addDoc(collection(db, "forum_comments"), {
          subjectId: String(subjectId),
          ownerUid: ownerUid,
          postId: postId,
          parentCommentId: parentCommentId,
          authorUid: currentUser.uid,
          authorName: getAuthorName(),
          content: content,
          createdAt: new Date().toISOString()
        });

        textarea.value = "";

      } catch (error) {
        console.error("Error publicando comentario:", error);
        alert("No se pudo publicar el comentario.");
      } finally {
        button.disabled = false;
      }
    });

    // Controlar respuestas y eliminación de comentarios.
    postsContainer.addEventListener('click', async (event) => {
      const replyButton = event.target.closest('.forum-reply-button');

      if (replyButton) {
        const form = replyButton.nextElementSibling;

        if (form && form.classList.contains('forum-comment-form')) {
          form.classList.toggle('hidden');

          if (!form.classList.contains('hidden')) {
            form.querySelector('textarea').focus();
          }
        }

        return;
      }

      const deleteButton = event.target.closest('.forum-delete-comment');
      if (!deleteButton) return;

      const commentId = deleteButton.dataset.commentId;
      const comment = commentsData.find(item => item.id === commentId);

      if (!comment || comment.authorUid !== currentUser.uid) {
        alert("Solamente podés eliminar tus propios comentarios.");
        return;
      }

      if (!confirm("¿Querés eliminar este comentario y todas sus respuestas?")) {
        return;
      }

      try {
        // Reunir el comentario y todas sus respuestas.
        const idsToDelete = new Set([commentId]);
        let foundNew = true;

        while (foundNew) {
          foundNew = false;

          commentsData.forEach(item => {
            if (
              item.parentCommentId &&
              idsToDelete.has(item.parentCommentId) &&
              !idsToDelete.has(item.id)
            ) {
              idsToDelete.add(item.id);
              foundNew = true;
            }
          });
        }

        // Eliminar todos los documentos de Firebase.
        for (const id of idsToDelete) {
          await deleteDoc(doc(db, "forum_comments", id));
        }

      } catch (error) {
        console.error("Error eliminando comentario:", error);
        alert("No se pudo eliminar el comentario.");
      }
    });
    // Construir un formulario de comentario o respuesta.
    const createCommentForm = (postId, parentId = "") => {
      const commentForm = document.createElement('form');
      commentForm.className = "forum-comment-form hidden mt-3 space-y-2";
      commentForm.dataset.postId = postId;
      commentForm.dataset.parentId = parentId;

      const textarea = document.createElement('textarea');
      textarea.required = true;
      textarea.rows = 2;
      textarea.maxLength = 2000;
      textarea.placeholder = "Escribí tu comentario...";
      textarea.className = "w-full border border-slate-200 rounded-lg p-2.5 text-sm";

      const button = document.createElement('button');
      button.type = "submit";
      button.textContent = "Enviar";
      button.className = "bg-violet-600 text-white text-xs font-semibold px-4 py-2 rounded-lg";

      commentForm.append(textarea, button);

      return commentForm;
    };

    // Construir cada comentario y sus respuestas.
    const buildComment = (comment, postId, allComments) => {
      const wrapper = document.createElement('div');

      wrapper.className = "bg-white border border-slate-200 rounded-xl p-3 mt-3 shadow-sm";

      const header = document.createElement('div');
      header.className = "flex items-center justify-between gap-2";

      const author = document.createElement('p');
      author.className = "text-sm font-bold text-slate-800";
      author.textContent = comment.authorName || "Usuario";

      const date = document.createElement('p');
      date.className = "text-xs text-slate-400";
      date.textContent = comment.createdAt
        ? new Date(comment.createdAt).toLocaleString('es-AR')
        : "";

      header.append(author, date);

      const content = document.createElement('p');
      content.className = "text-sm text-slate-700 whitespace-pre-wrap mt-3";
      content.textContent = comment.content || "";

      const actions = document.createElement('div');
      actions.className = "flex items-center gap-4 mt-3";

      const replyButton = document.createElement('button');
      replyButton.type = "button";
      replyButton.textContent = "↳ Responder";
      replyButton.className = "forum-reply-button text-xs font-semibold text-violet-600";

      actions.appendChild(replyButton);

      // Mostrar eliminar solamente al autor.
      if (comment.authorUid === currentUser.uid) {
        const deleteButton = document.createElement('button');
        deleteButton.type = "button";
        deleteButton.textContent = "Eliminar";
        deleteButton.className = "forum-delete-comment text-xs font-semibold text-rose-600";
        deleteButton.dataset.commentId = comment.id;

        actions.appendChild(deleteButton);
      }

      wrapper.append(header, content, actions);
      wrapper.appendChild(createCommentForm(postId, comment.id));

      // Mostrar respuestas dentro del comentario correspondiente.
      const replies = allComments
        .filter(item => item.parentCommentId === comment.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      if (replies.length > 0) {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = "ml-4 mt-3 pl-3 border-l-2 border-violet-200";

        replies.forEach(reply => {
          repliesContainer.appendChild(
            buildComment(reply, postId, allComments)
          );
        });

        wrapper.appendChild(repliesContainer);
      }

      return wrapper;
    };
    // Dibujar los temas y sus conversaciones.

    // Dibujar los temas y sus conversaciones.
    const renderForum = () => {
      postsContainer.innerHTML = "";

      if (postsData.length === 0) {
        postsContainer.textContent = "Todavía no hay temas de debate.";
        return;
      }

      postsData.forEach(post => {
        const card = document.createElement('article');
        card.className = "bg-slate-200 border border-slate-300 rounded-xl p-4 shadow-sm";
        const title = document.createElement('h4');
        title.className = "text-base font-bold text-slate-900";
        title.textContent = post.title || "Tema de debate";

        const author = document.createElement('p');
        author.className = "text-xs text-slate-500 mt-1";
        author.textContent = `${post.authorName || "Usuario"} · ${post.createdAt ? new Date(post.createdAt).toLocaleString('es-AR') : ""
          }`;

        const content = document.createElement('p');
        content.className = "text-sm text-slate-700 whitespace-pre-wrap mt-3";
        content.textContent = post.content || "";

        // Obtener todos los comentarios del tema.
        const postComments = commentsData.filter(
          comment => comment.postId === post.id
        );

        const rootComments = postComments
          .filter(comment => !comment.parentCommentId)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Crear la sección desplegable de la conversación.
        const conversation = document.createElement('details');
        conversation.className = "mt-5 border-t border-slate-200 pt-3";

        const summary = document.createElement('summary');
        summary.className = "cursor-pointer text-sm font-bold text-violet-700 py-2";

        const count = postComments.length;
        summary.textContent = `Ver conversación (${count} ${count === 1 ? "intervención" : "intervenciones"
          })`;

        const conversationBody = document.createElement('div');
        conversationBody.className = "pt-2";

        if (rootComments.length === 0) {
          const empty = document.createElement('p');
          empty.className = "text-xs text-slate-400 mt-2";
          empty.textContent = "Todavía no hay comentarios. ¡Iniciá la conversación!";
          conversationBody.appendChild(empty);
        }

        // Mostrar comentarios y todas sus respuestas.
        rootComments.forEach(comment => {
          conversationBody.appendChild(
            buildComment(comment, post.id, postComments)
          );
        });

        // Permitir agregar un comentario al tema.
        const commentButton = document.createElement('button');
        commentButton.type = "button";
        commentButton.textContent = "Escribir un comentario";
        commentButton.className = "forum-reply-button text-sm font-semibold text-violet-600 mt-4";

        conversationBody.appendChild(commentButton);
        conversationBody.appendChild(createCommentForm(post.id));

        conversation.append(summary, conversationBody);
        card.append(title, author, content, conversation);
        postsContainer.appendChild(card);
      });
    };


    // Resolver el propietario de la materia compartida.
    const loadForum = async () => {
      const membershipQuery = query(
        collection(db, "subject_members"),
        where("subjectId", "==", String(subjectId)),
        where("memberUid", "==", currentUser.uid)
      );

      const membershipSnapshot = await getDocs(membershipQuery);

      if (!membershipSnapshot.empty) {
        ownerUid = membershipSnapshot.docs[0].data().ownerUid;
      }

      // Escuchar los temas en tiempo real.
      const postsQuery = query(
        collection(db, "forum_posts"),
        where("subjectId", "==", String(subjectId)),
        where("ownerUid", "==", ownerUid)
      );

      this.subjectForumUnsubscribe = onSnapshot(
        postsQuery,
        snapshot => {
          postsData = snapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
          }));

          postsData.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
          );

          renderForum();
        },
        error => {
          console.error("Error escuchando temas:", error);
        }
      );

      // Escuchar todos los comentarios y respuestas.
      const commentsQuery = query(
        collection(db, "forum_comments"),
        where("subjectId", "==", String(subjectId)),
        where("ownerUid", "==", ownerUid)
      );

      this.subjectForumCommentsUnsubscribe = onSnapshot(
        commentsQuery,
        snapshot => {
          commentsData = snapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
          }));

          renderForum();
        },
        error => {
          console.error("Error escuchando comentarios:", error);
        }
      );
    };

    loadForum().catch(error => {
      console.error("Error iniciando el foro:", error);
      postsContainer.textContent = "No se pudo conectar con el foro.";
    });

    console.log("Foro de debates conectado:", subjectId);
  }

  openNewSubjectModal() {
    const modal = document.getElementById('modal-new-subject');
    if (modal) modal.classList.remove('hidden');
  }

  closeNewSubjectModal() {
    const modal = document.getElementById('modal-new-subject');
    if (modal) modal.classList.add('hidden');
  }

  openNewTaskModal() {
    const modal = document.getElementById('modal-new-task');
    if (modal) modal.classList.remove('hidden');
  }

  closeNewTaskModal() {
    const modal = document.getElementById('modal-new-task');
    if (modal) modal.classList.add('hidden');
  }

  confirmDeleteSubject(subjectId) {
    if (confirm("¿Estás seguro de que deseas eliminar esta materia? Esta acción recalculará todo el avance del Dashboard.")) {
      this.store.deleteSubject(subjectId);
    }
  }

  // ==========================================
  // VIEW 5: CRONÓMETRO / "BOTÓN B"
  // ==========================================
  renderTimerView(state) {
    const timer = this.store.timer;
    const timeDisplay = document.getElementById('main-timer-display');
    const startBtn = document.getElementById('timer-start-btn');
    const pauseBtn = document.getElementById('timer-pause-btn');
    const stopBtn = document.getElementById('timer-stop-btn');
    const timerCircle = document.getElementById('timer-container-circle');

    if (timeDisplay) timeDisplay.textContent = this.formatSeconds(timer.seconds);

    if (timerCircle) {
      if (timer.isRunning) {
        timerCircle.classList.add('timer-running-glow', 'border-violet-500');
        timerCircle.classList.remove('border-slate-200');
      } else {
        timerCircle.classList.remove('timer-running-glow', 'border-violet-500');
        timerCircle.classList.add('border-slate-200');
      }
    }

    if (startBtn && pauseBtn && stopBtn) {
      if (timer.isRunning) {
        startBtn.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
        stopBtn.removeAttribute('disabled');
        stopBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        startBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
        if (timer.seconds === 0) {
          stopBtn.setAttribute('disabled', 'true');
          stopBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
          stopBtn.removeAttribute('disabled');
          stopBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      }
    }

    // Populate subject selector dropdown
    const subSelect = document.getElementById('timer-subject-select');
    if (subSelect) {
      subSelect.innerHTML = `<option value="">-- Elige una materia --</option>` + state.subjects.map(s => `
        <option value="${s.id}">${s.name} (${s.code})</option>
      `).join('');
    }
  }

  startTimer() {
    if (this.store.timer.isRunning) return;
    this.store.timer.isRunning = true;

    this.timerTicker = setInterval(() => {
      this.store.timer.seconds++;
      const timeDisplay = document.getElementById('main-timer-display');
      if (timeDisplay) timeDisplay.textContent = this.formatSeconds(this.store.timer.seconds);

      const topDisplay = document.getElementById('topbar-timer-display');
      if (topDisplay) topDisplay.textContent = this.formatSeconds(this.store.timer.seconds);
    }, 1000);

    this.render();
  }

  pauseTimer() {
    this.store.timer.isRunning = false;
    clearInterval(this.timerTicker);
    this.render();
  }

  resetTimer() {
    this.pauseTimer();
    this.store.timer.seconds = 0;
    this.render();
  }

  stopTimerPrompt() {
    this.pauseTimer();
    if (this.store.timer.seconds < 1) {
      this.store.showToast("Inicia el cronómetro antes de asignar tiempo.");
      return;
    }

    // Populate stop modal
    const modal = document.getElementById('modal-assign-study-time');
    const minsRecorded = Math.max(1, Math.round(this.store.timer.seconds / 60));
    const timeSummary = document.getElementById('assign-time-summary');
    if (timeSummary) {
      timeSummary.textContent = `${this.formatSeconds(this.store.timer.seconds)} (~${minsRecorded} min)`;
    }

    const selectEl = document.getElementById('assign-subject-select');
    if (selectEl) {
      selectEl.innerHTML = this.store.state.subjects.map(s => `
        <option value="${s.id}">${s.name} (${s.code})</option>
      `).join('');
    }

    if (modal) modal.classList.remove('hidden');
  }

  confirmAssignStudyTime() {
    const selectEl = document.getElementById('assign-subject-select');
    const subjectId = selectEl.value;
    const minsRecorded = Math.max(1, Math.round(this.store.timer.seconds / 60));

    if (!subjectId) {
      alert("Por favor selecciona una materia");
      return;
    }

    this.store.addStudyTime(subjectId, minsRecorded);
    this.store.triggerConfetti();

    // Reset timer
    this.store.timer.seconds = 0;
    this.store.timer.isRunning = false;

    // Close modal
    const modal = document.getElementById('modal-assign-study-time');
    if (modal) modal.classList.add('hidden');

    this.render();
  }

  formatSeconds(totalSecs) {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // ==========================================
  // VIEW 6: CALENDARIO
  // ==========================================
  renderCalendar(state) {
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthLabel = document.getElementById('calendar-month-label');
    if (monthLabel) monthLabel.textContent = `${monthNames[month]} ${year}`;

    // Collect all events from subjects
    const allEvents = [];
    state.subjects.forEach(sub => {
      (sub.tasks || []).forEach(task => {
        allEvents.push({
          ...task,
          subjectName: sub.name,
          subjectCode: sub.code,
          subjectColor: sub.accent || '#8B5CF6'
        });
      });
    });

    // Calendar Grid Days
    const gridEl = document.getElementById('calendar-days-grid');
    if (!gridEl) return;

    gridEl.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Adjust so Monday is 0
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty offset cells
    for (let i = 0; i < startOffset; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'h-24 bg-slate-50/50 rounded-xl border border-dashed border-slate-200/50';
      gridEl.appendChild(emptyCell);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const isToday = dateStr === todayStr;

      const dayEvents = allEvents.filter(e => e.dueDate === dateStr);

      const cell = document.createElement('div');
      cell.className = `h-28 p-2 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${isToday
        ? 'bg-violet-50/60 border-violet-400 ring-2 ring-violet-400/20'
        : 'bg-white border-slate-200/80 hover:border-violet-300 hover:shadow-sm'
        }`;

      cell.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold ${isToday ? 'text-violet-700 bg-violet-200/70 w-5 h-5 flex items-center justify-center rounded-full' : 'text-slate-700'}">${day}</span>
          ${dayEvents.length > 0 ? `<span class="text-[10px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.2 rounded-full">${dayEvents.length}</span>` : ''}
        </div>
        <div class="space-y-1 overflow-hidden flex-1 mt-1">
          ${dayEvents.slice(0, 2).map(ev => {
        const isExam = ev.type === 'parcial' || ev.type === 'final';
        const isLectura = ev.type === 'lectura';
        const pillCls = isExam
          ? 'bg-amber-100 text-amber-900 font-semibold'
          : isLectura
            ? 'bg-teal-100 text-teal-900 font-semibold border border-teal-200'
            : 'bg-slate-100 text-slate-700';
        return `
              <div class="text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${pillCls}" title="${ev.title} (${ev.subjectCode})">
                ${isLectura ? '📖 ' : ''}${ev.title}
              </div>
            `;
      }).join('')}
          ${dayEvents.length > 2 ? `<div class="text-[9px] text-slate-400 font-medium">+${dayEvents.length - 2} más</div>` : ''}
        </div>
      `;

      cell.onclick = () => this.showCalendarDayEvents(dateStr, dayEvents);
      gridEl.appendChild(cell);
    }

    // Side list: upcoming 5 events
    const upcomingList = document.getElementById('calendar-upcoming-list');
    if (upcomingList) {
      const sortedEvents = [...allEvents].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      upcomingList.innerHTML = sortedEvents.slice(0, 5).map(ev => `
        <div class="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${ev.subjectColor}"></span>
            <div>
              <p class="text-xs font-bold text-slate-800 line-clamp-1">${ev.title}</p>
              <p class="text-[11px] text-slate-500">${ev.subjectName} • ${ev.type === 'lectura' ? '📖 LECTURA DIARIA' : ev.type.toUpperCase()}</p>
            </div>
          </div>
          <span class="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md shrink-0">
            ${ev.dueDate}
          </span>
        </div>
      `).join('');
    }
  }

  showCalendarDayEvents(dateStr, events) {
    const detailBox = document.getElementById('calendar-day-detail-box');
    const detailTitle = document.getElementById('calendar-day-detail-title');
    const detailContent = document.getElementById('calendar-day-detail-content');

    if (!detailBox) return;
    detailBox.classList.remove('hidden');
    detailTitle.textContent = `Eventos para el ${dateStr}`;

    if (events.length === 0) {
      detailContent.innerHTML = `<p class="text-xs text-slate-400 py-3">No hay actividades programadas para este día.</p>`;
    } else {
      detailContent.innerHTML = events.map(ev => `
        <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-slate-800">${ev.title}</p>
            <p class="text-[11px] text-slate-500">${ev.subjectName} (${ev.type})</p>
          </div>
          <span class="text-xs font-semibold ${ev.completed ? 'text-emerald-600' : 'text-amber-600'}">
            ${ev.completed ? '✓ Completado' : '⏳ Pendiente'}
          </span>
        </div>
      `).join('');
    }
  }

  prevMonth() {
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
    this.render();
  }

  nextMonth() {
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
    this.render();
  }


  // 3. Mover tareas en el tablero Kanban
  async moveTeamTask(taskId, newStatus) {
    const validStatuses = ["todo", "in_progress", "done"];

    if (!validStatuses.includes(newStatus)) {
      console.error("Estado de tarea inválido:", newStatus);
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
      this.store.showToast("Iniciá sesión para mover la tarea.");
      return;
    }

    try {
      const taskRef = doc(db, "team_tasks", taskId);
      const taskSnap = await getDoc(taskRef);

      if (!taskSnap.exists()) {
        this.store.showToast("La tarea ya no existe.");
        return;
      }

      const taskData = taskSnap.data();

      // Verificar si el usuario pertenece al equipo.
      let authorized = taskData.ownerUid === currentUser.uid;

      if (!authorized) {
        const membershipQuery = query(
          collection(db, "subject_members"),
          where("subjectId", "==", String(taskData.subjectId)),
          where("ownerUid", "==", taskData.ownerUid),
          where("memberUid", "==", currentUser.uid)
        );

        const membershipSnapshot = await getDocs(membershipQuery);

        authorized = !membershipSnapshot.empty;
      }

      if (!authorized) {
        this.store.showToast("No tenés permiso para modificar esta tarea.");
        return;
      }

      await updateDoc(taskRef, {
        status: newStatus
      });

      const task = this.store.state.team.tasks.find(
        t => t.id === taskId
      );

      if (task) {
        task.status = newStatus;
      }

      this.store.saveState();

      // Actualizar el tablero Kanban
      this.renderTeam(this.store.state);

      // Actualizar el dashboard si está visible
      if (this.currentView === 'dashboard') {
        this.renderDashboard(this.store.state);
      }

      this.store.showToast("Estado de la tarea actualizado.");
    } catch (error) {
      console.error("Error al mover la tarea:", error);
      this.store.showToast("No se pudo actualizar el estado.");
    }
  }
  // Método para renderizar la vista de equipo y tablero Kanban
  renderTeam(state) {
    if (!state || !state.team) return;

    const team = state.team;
    document.getElementById('team-project-title').textContent = team.projectName;

    // Team members avatars
    const membersList = document.getElementById('team-members-list');
    if (membersList) {
      membersList.innerHTML = team.members.map(m => `
      <div class="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-sm">
        <img src="${m.avatar}" class="w-10 h-10 rounded-full object-cover border-2 border-violet-100" />
        <div>
          <h4 class="text-xs font-bold text-slate-900">${m.name}</h4>
          <p class="text-[11px] text-slate-500">${m.role}</p>
        </div>
      </div>
    `).join('');
    }

    // Selector de materia del tablero Kanban
    const subjectSelect = document.querySelector('#view-team #team-board-subject-select');
    console.log("SELECTOR ENCONTRADO:", subjectSelect);
    console.log("ID DEL SELECTOR:", subjectSelect?.id);
    console.log("CANTIDAD DE OPCIONES:", subjectSelect?.options.length);
    const allSubjects = [
      ...(Array.isArray(state.subjects) ? state.subjects : []),
      ...(Array.isArray(state.sharedSubjects) ? state.sharedSubjects : [])
    ].filter(subject => {
      const currentUid = auth.currentUser?.uid;

      if (subject.isShared === true) {
        return true;
      }

      if (subject.ownerUid === currentUid) {
        return true;
      }

      if (!subject.ownerUid) {
        return true;
      }

      return false;
    });

    // Evitar materias duplicadas por nombre.
    // Si existe una compartida, tendrá prioridad en el Kanban.
    const subjectsByName = new Map();

    allSubjects.forEach(subject => {
      const normalizedName = (subject.name || '').trim().toLowerCase();

      if (!subjectsByName.has(normalizedName)) {
        subjectsByName.set(normalizedName, subject);
        return;
      }

      const existing = subjectsByName.get(normalizedName);

      if (subject.isShared && !existing.isShared) {
        subjectsByName.set(normalizedName, subject);
      }
    });

    const subjects = Array.from(subjectsByName.values());
    console.log("📚 Materias propias:", state.subjects);
    console.log("📚 Materias compartidas:", state.sharedSubjects);
    console.log("📚 Materias que muestra el tablero:", subjects);
    if (subjectSelect) {
      const previousValue = subjectSelect.value;

      subjectSelect.innerHTML = subjects.length
        ? subjects.map(subject => `
  <option value="${subject.id}">
    ${subject.name}${subject.isShared ? ' (Compartida)' : ''}
  </option>
`).join("")
        : '<option value="">Primero agregá una materia</option>';
      const selectedSubject = subjects.some(
        subject => String(subject.id) === String(previousValue)
      )
        ? previousValue
        : String(subjects[0]?.id || "");

      subjectSelect.value = selectedSubject;
      subjectSelect.disabled = subjects.length === 0;
      console.log("Materias disponibles:", subjects.length, subjects.map(s => s.name));
      console.log("Opciones del selector:", subjectSelect.options.length, "Valor seleccionado:", subjectSelect.value);

      // Darle aspecto de título desplegable central.
      subjectSelect.className =
        "w-full max-w-2xl mx-auto block rounded-2xl border-2 " +
        "border-violet-200 bg-white px-5 py-4 text-center " +
        "text-2xl font-bold text-slate-900 shadow-sm " +
        "focus:outline-none focus:ring-2 focus:ring-violet-500";

      subjectSelect.setAttribute(
        "aria-label",
        "Seleccionar materia del tablero"
      );

      const parent = subjectSelect.parentElement;

      if (parent) {
        parent.classList.add(
          "flex",
          "flex-col",
          "items-center",
          "justify-center",
          "w-full",
          "py-5"
        );
      }
    }
    if (subjectSelect) {
      subjectSelect.onchange = async event => {
        const selectedSubjectId = event.target.value;

        if (!selectedSubjectId) return;

        this.selectedTeamTaskSubjectId = selectedSubjectId;

        await this.loadTeamTasks(selectedSubjectId);
        await this.loadTeamMembersFromFirebase(selectedSubjectId);

        this.renderTeam(this.store.state);
      };
      // Cargar las tareas de la materia seleccionada al abrir el tablero.
      const initialSubjectId = subjectSelect.value;

      if (
        initialSubjectId &&
        this.selectedTeamTaskSubjectId !== initialSubjectId
      ) {
        this.selectedTeamTaskSubjectId = initialSubjectId;

        this.loadTeamTasks(initialSubjectId).then(async () => {
          await this.loadTeamMembersFromFirebase(initialSubjectId);
          this.renderTeam(this.store.state);
        });
      }
      // Populate Kanban Columns
      const statuses = ['todo', 'in_progress', 'done'];
      statuses.forEach(status => {
        const col = document.getElementById(`kanban-col-${status}`);
        if (!col) return;

        const tasks = team.tasks.filter(t => t.status === status);
        col.innerHTML = tasks.length === 0
          ? `<div class="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">Sin tareas</div>`
          : tasks.map(task => {
            const member = team.members.find(m => m.id === task.assigneeId) || { name: 'Sin asignar', avatar: '' };
            const priorityCls = {
              alta: 'bg-rose-100 text-rose-700',
              media: 'bg-amber-100 text-amber-700',
              baja: 'bg-slate-100 text-slate-700'
            }[task.priority] || 'bg-slate-100 text-slate-700';

            return `
    <div class="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow transition-all relative group">
        <!-- Botones para editar y eliminar tarea -->
<div class="absolute top-2 right-2 flex items-center gap-1">

    <button
        onclick="window.visariApp.openEditTeamTaskModal('${task.id}')"
        class="text-violet-500 hover:text-violet-700 text-xs font-semibold px-1.5 py-0.5 rounded"
        title="Editar tarea">
        ✎
    </button>

    <button
        onclick="window.visariApp.deleteTeamTask('${task.id}')"
        class="text-slate-400 hover:text-red-500 text-xs font-bold px-1.5 py-0.5 rounded transition-colors"
        title="Eliminar tarea">
        &times;
    </button>

</div>

        <div class="flex items-center justify-between gap-2 mb-2 pr-4">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${priorityCls}">
                ${task.priority}
            </span>
        </div>
        
        <h4 class="text-xs font-bold text-slate-800 leading-snug mb-2 pr-4">${task.title}</h4>
        <div class="mb-3">
  <label class="block text-[10px] font-semibold text-slate-500 mb-1">
    Estado de la tarea
  </label>

  <select
    class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium"
    onchange="window.visariApp.moveTeamTask('${task.id}', this.value)"
    aria-label="Cambiar estado de la tarea"
  >
    <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>
      Por hacer
    </option>

    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>
      En curso
    </option>

    <option value="done" ${task.status === 'done' ? 'selected' : ''}>
      Completado
    </option>
  </select>
</div>
        <!-- El resto de tus elementos de la tarjeta... -->
                <div class="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div class="flex items-center gap-1.5">
                    <img src="${member.avatar}" class="w-5 h-5 rounded-full object-cover" />
                    <span class="text-[11px] text-slate-600 font-medium truncate max-w-[90px]">${member.name}</span>
                  </div>
                  <span class="text-[10px] text-slate-400 font-medium">📅 ${task.dueDate}</span>
                            </div>
                        </div>
                    `;
          }).join('');
      });
      if (typeof this.renderGroupProjectModule === "function") {
        this.renderGroupProjectModule(this.store.state);
      }
      const forumSubjectId = subjectSelect.value;

      if (
        forumSubjectId &&
        typeof this.renderSubjectForum === "function"
      ) {
        this.renderSubjectForum(forumSubjectId);
      }
    }
  }

  // ==========================================
  // MÓDULO COLABORATIVO Y SOLICITUDES POR MATERIA
  // ==========================================

  renderGroupProjectModule(state = this.store.state) {
    const container = document.getElementById('group-project-container');
    if (!container) return;

    const currentUser = auth.currentUser;

    const allSubjects = Array.isArray(this.store.state.subjects)
      ? this.store.state.subjects
      : [];

    const subjects = allSubjects.filter(subject => {
      // Si la materia tiene propietario registrado, debe coincidir
      // con la cuenta que inició sesión.
      if (subject.ownerUid) {
        return subject.ownerUid === currentUser?.uid;
      }

      // Compatibilidad con materias antiguas que todavía no tienen UID.
      // Se conservan porque pertenecen al estado local de esta cuenta.
      return true;
    });
    // Mantener la materia seleccionada mientras se actualiza la vista.
    const selectedSubjectId = subjects.some(
      subject => subject.id === this.selectedInviteSubjectId
    )
      ? this.selectedInviteSubjectId
      : (subjects[0]?.id || '');

    this.selectedInviteSubjectId = selectedSubjectId;

    container.innerHTML = `
      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div class="mb-4">
          <h3 class="text-base font-bold text-slate-900 mb-1">
            Invitar integrante al equipo
          </h3>
          <p class="text-sm text-slate-500">
            Seleccioná una materia e ingresá el correo de tu compañero.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="study-request-subject"
              class="block text-xs font-semibold text-slate-700 mb-2">
              Materia
            </label>

            <select
              id="study-request-subject"
              onchange="window.visariApp.selectedInviteSubjectId = this.value"
              class="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              ${subjects.length === 0 ? 'disabled' : ''}
            >
              ${subjects.length
        ? subjects.map(subject => `
                      <option
                        value="${subject.id}"
                        ${subject.id === selectedSubjectId ? 'selected' : ''}
                      >${subject.name}</option>
                    `).join('')
        : '<option value="">Primero agregá una materia</option>'
      }
            </select>
          </div>

          <div>
            <label for="partner-email-input"
              class="block text-xs font-semibold text-slate-700 mb-2">
              Correo del compañero
            </label>

            <input
              type="email"
              id="partner-email-input"
              placeholder="correo@universidad.edu"
              class="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              ${subjects.length === 0 ? 'disabled' : ''}
            />
          </div>
        </div>

        <div class="mt-4 flex justify-end">
          <button
            type="button"
            onclick="window.visariApp.sendStudyRequest()"
            class="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition"
            ${subjects.length === 0 ? 'disabled' : ''}
          >
            Enviar invitación
          </button>
        </div>
            </div>

      <!-- INVITACIONES RECIBIDAS -->
      <div class="mt-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div class="mb-4">
          <h3 class="text-base font-bold text-slate-900 mb-1">
            Invitaciones recibidas
          </h3>
          <p class="text-sm text-slate-500">
            Solicitudes de compañeros que quieren trabajar con vos.
          </p>
        </div>

        <div id="incoming-study-requests" class="space-y-3">
          <p class="text-sm text-slate-400">
            Cargando invitaciones...
          </p>
        </div>
      </div>
    `;

    this.renderIncomingStudyRequests();
  }
  async renderIncomingStudyRequests() {
    const container = document.getElementById('incoming-study-requests');

    if (!container) return;

    const requests = await this.loadIncomingStudyRequests();

    if (!document.getElementById('incoming-study-requests')) return;

    if (requests.length === 0) {
      container.innerHTML = `
            <p class="text-sm text-slate-400">
                No tenés invitaciones pendientes.
            </p>
        `;
      return;
    }

    container.innerHTML = requests.map(request => `
        <div class="p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
                <p class="text-sm font-bold text-slate-800">
                    ${request.fromUser || 'Un compañero'}
                </p>
               <p class="text-xs text-slate-500 mt-1">
    Te invita a colaborar en:
    <strong class="text-violet-700">
        ${request.subjectName || 'Materia sin nombre'}
    </strong>
</p>
            </div>

            <div class="flex gap-2">
                <button
                    onclick="window.visariApp.respondToStudyRequest('${request.id}', 'accepted')"
                    class="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg"
                >
                    Aceptar
                </button>

                <button
                    onclick="window.visariApp.respondToStudyRequest('${request.id}', 'rejected')"
                    class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                >
                    Rechazar
                </button>
            </div>
        </div>
    `).join('');
  }
  async respondToStudyRequest(requestId, response) {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid || !currentUser?.email) {
      alert("Tenés que iniciar sesión para responder una invitación.");
      return;
    }

    if (!["accepted", "rejected"].includes(response)) {
      return;
    }

    try {
      const requestRef = doc(db, "study_requests", requestId);
      const requestSnapshot = await getDoc(requestRef);

      if (!requestSnapshot.exists()) {
        alert("Esta invitación ya no existe.");
        return;
      }

      const requestData = requestSnapshot.data();

      if (
        requestData.toUserEmail?.toLowerCase() !==
        currentUser.email.toLowerCase()
      ) {
        alert("No tenés permiso para responder esta invitación.");
        return;
      }

      if (requestData.status !== "pending") {
        alert("Esta invitación ya fue respondida.");
        await this.renderIncomingStudyRequests();
        return;
      }

      // Si acepta, registramos su incorporación al equipo.
      if (response === "accepted") {

        if (!requestData.fromUid) {
          alert("Esta invitación no tiene registrado el propietario. Es necesario enviar una nueva invitación.");
          return;
        }

        const memberId = `${requestData.subjectId}_${currentUser.uid}`;

        const memberRef = doc(db, "subject_members", memberId);

        await setDoc(memberRef, {
          subjectId: requestData.subjectId,
          subjectName: requestData.subjectName || "Materia sin nombre",
          ownerUid: requestData.fromUid,
          memberUid: currentUser.uid,
          memberEmail: currentUser.email.toLowerCase(),
          role: "member",
          joinedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Actualizamos el estado de la invitación.
      await updateDoc(requestRef, {
        status: response,
        acceptedByUid: response === "accepted" ? currentUser.uid : null,
        acceptedByEmail: currentUser.email.toLowerCase(),
        respondedAt: new Date().toISOString()
      });

      // Actualizar las materias compartidas después de aceptar.
      if (response === "accepted") {
        await this.loadSharedSubjectsFromFirebase(currentUser.uid);
        this.renderTeam(this.store.state);
      }

      if (response === "accepted") {
        alert("¡Aceptaste la invitación! Ahora formás parte del equipo.");
      } else {
        alert("Rechazaste la invitación.");
      }

      await this.renderIncomingStudyRequests();

    } catch (error) {
      console.error("Error al responder la invitación:", error);
      alert("No se pudo procesar la invitación. Revisá la consola y los permisos de Firestore.");
    }
  }
  async sendStudyRequest(subjectId) {
    const input = document.getElementById('partner-email-input');
    const subjectSelect = document.getElementById('study-request-subject');

    const targetEmail = input ? input.value.trim() : '';
    const selectedSubjectId =
      subjectId ||
      (subjectSelect ? subjectSelect.value : '') ||
      this.selectedInviteSubjectId ||
      '';
    const selectedSubject = this.store.state.subjects.find(
      subject => String(subject.id) === String(selectedSubjectId)
    );

    const selectedSubjectName = selectedSubject?.name || 'Materia sin nombre';
    if (!selectedSubjectId) {
      alert("Seleccioná una materia antes de enviar la invitación.");
      return;
    }

    if (!targetEmail) {
      alert("Por favor, ingresá el correo electrónico de tu compañero.");
      return;
    }

    // Validación básica del correo.
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(targetEmail)) {
      alert("Ingresá una dirección de correo electrónico válida.");
      return;
    }

    const currentUserEmail =
      this.store.state.user?.email ||
      auth.currentUser?.email ||
      '';

    if (
      currentUserEmail &&
      currentUserEmail.toLowerCase() === targetEmail.toLowerCase()
    ) {
      alert("No podés enviarte una invitación a tu propio correo.");
      return;
    }

    try {
      await addDoc(collection(db, "study_requests"), {
        fromUser: currentUserEmail || "usuario_actual",
        fromUid: auth.currentUser?.uid || null,
        toUserEmail: targetEmail.toLowerCase(),
        subjectId: selectedSubjectId,
        subjectName: selectedSubjectName,
        status: "pending",
        createdAt: new Date().toISOString()
      });

      alert(`¡Solicitud enviada a ${targetEmail} con éxito!`);

      if (input) {
        input.value = '';
      }
    } catch (error) {
      console.error("Error al enviar la solicitud:", error);
      alert(
        "Ocurrió un error al enviar la solicitud. Verificá la conexión y los permisos de Firestore."
      );
    }
  }
  async loadIncomingStudyRequests() {
    const currentUser = auth.currentUser;

    if (!currentUser?.email) return [];

    try {
      const q = query(
        collection(db, "study_requests"),
        where("toUserEmail", "==", currentUser.email.toLowerCase()),
        where("status", "==", "pending")
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      }));

    } catch (error) {
      console.error("Error cargando invitaciones recibidas:", error);
      return [];
    }
  }
  async loadTeamMembersFromFirebase(subjectId) {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid || !subjectId) return;

    try {
      // Identificar al propietario del equipo.
      let ownerUid = currentUser.uid;

      const membershipQuery = query(
        collection(db, "subject_members"),
        where("subjectId", "==", String(subjectId)),
        where("memberUid", "==", currentUser.uid)
      );

      const membershipSnapshot = await getDocs(membershipQuery);

      if (!membershipSnapshot.empty) {
        ownerUid = membershipSnapshot.docs[0].data().ownerUid;
      }

      // Buscar todos los integrantes de ese propietario y materia.
      const q = query(
        collection(db, "subject_members"),
        where("subjectId", "==", String(subjectId)),
        where("ownerUid", "==", ownerUid)
      );

      const querySnapshot = await getDocs(q);

      // Incorporar al propietario.
      const members = [{
        id: ownerUid,
        name: ownerUid === currentUser.uid
          ? (currentUser.displayName || currentUser.email.split("@")[0])
          : "Propietario",
        email: ownerUid === currentUser.uid ? currentUser.email : "",
        role: "owner"
      }];

      // Incorporar a los compañeros que aceptaron.
      querySnapshot.forEach(document => {
        const data = document.data();

        members.push({
          id: data.memberUid,
          name: data.memberEmail
            ? data.memberEmail.split("@")[0]
            : "Compañero",
          email: data.memberEmail || "",
          role: data.role || "member"
        });
      });

      // Evitar integrantes duplicados.
      const uniqueMembers = [
        ...new Map(members.map(member => [member.id, member])).values()
      ];

      this.state.team_members = uniqueMembers;

      if (this.state.team) {
        this.state.team.members = uniqueMembers;
      }

      if (this.store?.state?.team) {
        this.store.state.team.members = uniqueMembers;
      }

      console.log("Integrantes cargados:", uniqueMembers);

    } catch (error) {
      console.error("Error cargando integrantes desde Firebase:", error);
    }
  }
  openNewTeamTaskModal() {
    const modal = document.getElementById('modal-new-team-task');
    const selectMember = document.getElementById('team-task-assignee');
    const subjectSelect = document.getElementById('team-subject-select');
    const boardSelect = document.getElementById('team-board-subject-select');

    const subjects = [
      ...(Array.isArray(this.store?.state?.subjects)
        ? this.store.state.subjects
        : []),

      ...(Array.isArray(this.store?.state?.sharedSubjects)
        ? this.store.state.sharedSubjects
        : [])
    ];

    // Obtener la materia seleccionada en el tablero Kanban
    const boardSubjectId = boardSelect?.value || this.selectedTeamTaskSubjectId || '';

    if (subjectSelect) {
      subjectSelect.innerHTML = subjects.map(subject => `
        <option value="${subject.id}">
          ${subject.name}${subject.isShared ? ' (Compartida)' : ''}
        </option>
      `).join('');

      // Sincronizar el formulario con el tablero
      if (subjects.some(subject => String(subject.id) === String(boardSubjectId))) {
        subjectSelect.value = boardSubjectId;
      }
    }

    const subjectId = subjectSelect?.value || '';

    if (!subjectId) {
      alert("No hay materias disponibles. Primero seleccioná una materia en el Kanban.");
      return;
    }

    this.selectedTeamTaskSubjectId = subjectId;

    console.log("📚 Materia seleccionada para la tarea:", subjectId);

    if (selectMember) {
      const members = Array.isArray(this.store?.state?.team_members)
        ? this.store.state.team_members
        : [];

      selectMember.innerHTML = members.length > 0
        ? members.map(m => `
            <option value="${m.id}">${m.name}</option>
          `).join('')
        : `<option value="me">Yo</option>`;
    }

    if (modal) {
      modal.classList.remove('hidden');
    } else {
      console.error("No se encontró el modal de tareas grupales.");
    }
  }
  async handleNewTeamTaskSubmit(event) {
    event.preventDefault();

    const title = document.getElementById('team-task-title')?.value.trim();
    const subjectId =
      this.selectedTeamTaskSubjectId ||
      document.getElementById('team-subject-select')?.value;
    const assigneeId = document.getElementById('team-task-assignee')?.value;
    const priority = document.getElementById('team-task-priority')?.value;
    const dueDate = document.getElementById('team-task-date')?.value;

    if (!title) {
      this.store.showToast("Ingresá el nombre de la tarea.");
      return;
    }

    if (!subjectId) {
      this.store.showToast("Seleccioná una materia.");
      return;
    }

    try {
      const saved = await this.store.addTeamTask({
        title,
        subjectId,
        assigneeId,
        priority,
        dueDate,
        status: "todo"
      });

      // Si el guardado falla, dejamos el modal abierto.
      if (saved !== true) return;

      await this.loadTeamTasks(subjectId);
      this.renderTeam(this.store.state);

      this.closeNewTeamTaskModal();

    } catch (error) {
      console.error("Error al asignar tarea al tablero:", error);
      this.store.showToast("No se pudo asignar la tarea.");
    }
  }
  async loadTeamTasks(subjectId) {
    console.log("📚 Materia seleccionada:", subjectId);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        console.error("❌ No hay un usuario autenticado.");
        return;
      }

      if (!subjectId) {
        console.warn("⚠️ No se seleccionó ninguna materia.");
        return;
      }

      // Identificar quién es el propietario del equipo.
      let ownerUid = currentUser.uid;

      // Si soy un invitado, buscar quién es el propietario.
      const membershipQuery = query(
        collection(db, "subject_members"),
        where("subjectId", "==", String(subjectId)),
        where("memberUid", "==", currentUser.uid)
      );

      const membershipSnapshot = await getDocs(membershipQuery);

      if (!membershipSnapshot.empty) {
        ownerUid = membershipSnapshot.docs[0].data().ownerUid;
      }

      console.log("👤 Propietario del equipo:", ownerUid);

      // Buscar las tareas del propietario.
      const tasksQuery = query(
        collection(db, "team_tasks"),
        where("ownerUid", "==", ownerUid),
        where("subjectId", "==", String(subjectId))
      );

      const snapshot = await getDocs(tasksQuery);

      console.log("📦 Documentos encontrados:", snapshot.size);

      // Trabajar con el estado de VisariStore.
      const store = this.store;

      if (!store || !store.state) {
        throw new Error("No se encontró el estado de VisariStore.");
      }

      // Asegurar que exista el espacio para las tareas del equipo.
      if (!store.state.team) {
        store.state.team = { tasks: [] };
      }

      if (!Array.isArray(store.state.team.tasks)) {
        store.state.team.tasks = [];
      }

      // Cargar las tareas recuperadas desde Firestore.
      store.state.team.tasks = snapshot.docs.map(taskDoc => ({
        ...taskDoc.data(),
        id: taskDoc.id
      }));

      console.log(
        "📋 Tareas cargadas en el estado:",
        store.state.team.tasks
      );

      // Guardar el estado local actualizado.
      store.saveState();

    } catch (error) {
      console.error("❌ Error al cargar tareas de Firestore:", error);
      console.error("Código:", error.code);
      console.error("Mensaje:", error.message);
    }
  }
  closeNewTeamTaskModal() {
    const modal = document.getElementById('modal-new-team-task');
    if (modal) modal.classList.add('hidden');
  }
  async deleteTeamTask(taskId) {
    console.log("🗑️ Eliminando tarea:", taskId);

    if (
      taskId === undefined ||
      taskId === null ||
      String(taskId).trim() === ""
    ) {
      console.error("ID de tarea inválido.");
      return;
    }

    if (!confirm("¿Estás seguro de querer eliminar esta tarea?")) {
      return;
    }

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        this.store.showToast("Iniciá sesión para eliminar la tarea.");
        return;
      }

      const taskRef = doc(db, "team_tasks", String(taskId));
      const taskSnap = await getDoc(taskRef);

      if (!taskSnap.exists()) {
        this.store.showToast("La tarea ya no existe.");
        return;
      }

      const taskData = taskSnap.data();

      let authorized = taskData.ownerUid === currentUser.uid;

      if (!authorized) {
        const membershipQuery = query(
          collection(db, "subject_members"),
          where("subjectId", "==", String(taskData.subjectId)),
          where("ownerUid", "==", taskData.ownerUid),
          where("memberUid", "==", currentUser.uid)
        );

        const membershipSnapshot = await getDocs(membershipQuery);
        authorized = !membershipSnapshot.empty;
      }

      if (!authorized) {
        this.store.showToast("No tenés permiso para eliminar esta tarea.");
        return;
      }

      await deleteDoc(taskRef);

      console.log("✅ Tarea eliminada de Firestore:", taskId);

      const tasks = this.store.state.team.tasks || [];

      this.store.state.team.tasks = tasks.filter(
        task => String(task.id) !== String(taskId)
      );

      this.store.saveState();
      this.renderTeam(this.store.state);

      console.log("✅ Tablero Kanban actualizado.");

    } catch (error) {
      console.error("❌ Error al eliminar la tarea:", error);
      alert("No se pudo eliminar la tarea. Revisá la consola para ver el error.");
    }
  }

} // <--- Esta es la llave que cierra la clase VisariApp

// Inicializar VISARi cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.visariApp = new VisariApp();
  window.app = window.visariApp;
  console.log('VISARi inicializada correctamente', window.visariApp);
});
