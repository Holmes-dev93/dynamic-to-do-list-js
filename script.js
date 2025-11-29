/**
 * Advanced Application of JavaScript: To-Do List (Task 1: Persistence using Firestore)
 * Extends Task 0 functionality to save and load tasks from the cloud.
 */

// --- FIREBASE IMPORTS (REQUIRED FOR PERSISTENCE) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, onSnapshot, doc, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL VARIABLES & FIREBASE SETUP ---

// Mandatorily use the global variables provided by the environment
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const authToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth;
let userId = null;
let isAuthReady = false;

// Select DOM elements
let addButton;
let taskInput;
let taskList;
let messageBox;
let userIdDisplay;

// Helper function to show messages instead of alert() or confirm()
function showMessage(text, isError = true) {
    messageBox.textContent = text;
    if (isError) {
        messageBox.style.backgroundColor = '#f8d7da'; // Light red/error
        messageBox.style.color = '#721c24';
        messageBox.style.border = '1px solid #f5c6cb';
    } else {
        messageBox.style.backgroundColor = '#d4edda'; // Light green/success
        messageBox.style.color = '#155724';
        messageBox.style.border = '1px solid #c3e6cb';
    }
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 3000);
}

// --- CORE FUNCTIONS (MODIFIED FOR FIRESTORE) ---

/**
 * Creates a new task item (li) for the DOM.
 * @param {Object} task - The task object from Firestore (including docId and text).
 */
function createTaskElement(task) {
    const listItem = document.createElement('li');
    // Store the document ID on the element for easy removal
    listItem.setAttribute('data-doc-id', task.id);
    listItem.textContent = task.text;

    const removeButton = document.createElement('button');
    removeButton.textContent = "Remove";
    removeButton.className = 'remove-btn';

    // Attach click handler to remove task from DOM and Firestore
    removeButton.onclick = async function() {
        if (!db || !userId) {
            showMessage("Database is not ready. Please wait.");
            return;
        }
        try {
            // Firestore data path: /artifacts/{appId}/users/{userId}/tasks
            const taskRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, task.id);
            await deleteDoc(taskRef);
            // onSnapshot will handle the removal from the DOM automatically
        } catch (e) {
            console.error("Error removing document: ", e);
            showMessage("Failed to remove task. Check console for details.", true);
        }
    };

    listItem.appendChild(removeButton);
    return listItem;
}

/**
 * Adds a new task to Firestore.
 */
async function addTask() {
    const taskText = taskInput.value.trim();

    if (taskText === "") {
        showMessage("Please enter a task.", true);
        return;
    }

    if (!db || !userId) {
        showMessage("Database is not ready. Please wait.", true);
        return;
    }

    try {
        // Firestore data path: /artifacts/{appId}/users/{userId}/tasks
        const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/tasks`);
        await addDoc(tasksCollectionRef, {
            text: taskText,
            createdAt: Date.now()
        });
        
        // Clear the input field only after successful submission
        taskInput.value = "";
        // Optional: showMessage("Task added successfully!", false);
        
    } catch (e) {
        console.error("Error adding document: ", e);
        showMessage("Failed to add task. Check console for details.", true);
    }
}


/**
 * Sets up a real-time listener to load and update tasks from Firestore.
 */
function setupRealtimeListener() {
    if (!db || !userId) {
        console.warn("Real-time listener skipped: DB or User ID not available.");
        return;
    }

    // Firestore data path: /artifacts/{appId}/users/{userId}/tasks
    const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/tasks`);
    const q = query(tasksCollectionRef);
    
    // onSnapshot listener provides real-time updates
    onSnapshot(q, (snapshot) => {
        // 1. Clear the current list in the DOM
        taskList.innerHTML = ''; 
        
        // 2. Iterate through all current documents
        const tasks = [];
        snapshot.forEach(doc => {
            tasks.push({ id: doc.id, ...doc.data() });
        });
        
        // 3. Sort tasks locally by creation time (ascending)
        tasks.sort((a, b) => a.createdAt - b.createdAt);

        // 4. Create and append the new list items
        tasks.forEach(task => {
            const element = createTaskElement(task);
            taskList.appendChild(element);
        });

        showMessage(`Loaded ${tasks.length} tasks from the database.`, false);
    }, (error) => {
        console.error("Firestore real-time error:", error);
        showMessage("Failed to load tasks in real-time.", true);
    });
}


// --- INITIALIZATION AND AUTHENTICATION ---

async function initializeAppAndAuth() {
    try {
        // 1. Initialize Firebase
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // 2. Insert message box and user ID display elements
        const todoApp = document.getElementById('todo-app');
        messageBox = document.createElement('div');
        messageBox.id = 'message-box';
        messageBox.style.display = 'none';
        
        // User ID Display (MANDATORY for multi-user apps)
        userIdDisplay = document.createElement('p');
        userIdDisplay.id = 'user-id-display';
        userIdDisplay.innerHTML = 'Status: Initializing...';
        
        const h1 = todoApp.querySelector('h1');
        h1.after(userIdDisplay, messageBox);

        // 3. Authenticate User
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in (either from token or anonymous sign-in)
                userId = user.uid;
                userIdDisplay.innerHTML = `User ID: <strong>${userId}</strong>`;
                isAuthReady = true;

                // 4. If authenticated, set up the task listener
                setupRealtimeListener();

            } else {
                // No user is signed in, sign in anonymously or with custom token
                try {
                    if (authToken) {
                        await signInWithCustomToken(auth, authToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Firebase Auth Error:", error);
                    userIdDisplay.innerHTML = 'Status: Authentication Failed!';
                    showMessage("Authentication failed. Cannot load tasks.", true);
                }
            }
        });

    } catch (e) {
        console.error("Firebase Initialization Error:", e);
        showMessage("Application failed to initialize. Check console.", true);
    }
}


// --- DOMContentLoaded EVENT LISTENER ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Select initial required elements
    addButton = document.getElementById('add-task-btn');
    taskInput = document.getElementById('task-input');
    taskList = document.getElementById('task-list');

    // 2. Initialize Firebase and start auth process
    initializeAppAndAuth();

    // 3. Attach Event Listeners for adding tasks
    
    // Add task on button click (async function)
    addButton.addEventListener('click', addTask);
    
    // Add task on Enter keypress (async function)
    taskInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addTask();
        }
    });
});
