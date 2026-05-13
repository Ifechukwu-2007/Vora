import { auth, db } from './firebase-config.js';
import { 
  collection, 
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import LoadingSpinner from './loading-utils.js';
import { supabase } from './supabase.js';

// Check admin access
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    LoadingSpinner.navigateTo('login.html');
    return;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists() || userSnap.data().role !== 'admin') {
      // Redirect without showing page content
      LoadingSpinner.navigateTo('404.html?attempted=admin-services');
      return;
    }

    // User is authorized - show the page
    document.body.classList.add('authorized');
  } catch (error) {
    console.error('Error checking admin role:', error);
    LoadingSpinner.navigateTo('404.html?attempted=admin-services');
  }
});

let docs = [];
let filtered = [];
let currentDocId = null;

const tableBody = document.getElementById("tableBody");
const panel = document.getElementById("panel");
const editor = document.getElementById("editor");
const search = document.getElementById("search");
const addBtn = document.getElementById("addServiceBtn");
const saveBtn = document.getElementById("save");
const deleteBtn = document.getElementById("delete");

// ================= LOAD SERVICES =================
const loadServices = async () => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*');
    
    if (error) throw error;
    
    docs = data.map(service => ({
      id: service.id,
      ...service,
      providerName: service.provider_name || 'N/A'
    }));
    
    filtered = [...docs];
    renderTable();
  } catch (error) {
    console.error('Error loading services:', error);
  }
};

// Set up real-time subscription
supabase
  .channel('services_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, (payload) => {
    console.log('Services change detected:', payload);
    loadServices(); // Reload services when changes occur
  })
  .subscribe();

// Initial load
loadServices();
  render();
});

// ================= RENDER =================
function render() {
  if (!filtered.length) {
    tableBody.innerHTML = `<div class="p-4 text-gray-400">No services</div>`;
    return;
  }

  tableBody.innerHTML = filtered.map(s => `
    <div class="grid grid-cols-5 border-b py-3 text-sm hover:bg-gray-50 cursor-pointer"
         onclick="openDoc('${s.id}')">

      <div>${s.title || s.name || "-"}</div>
      <div>₦${(s.price || 0).toLocaleString()}</div>
      <div>${s.providerName || s.provider || "-"}</div>
      <div>
        <span class="text-xs px-2 py-1 rounded ${
          s.status === "approved" ? "bg-green-100 text-green-700" :
          s.status === "pending" ? "bg-yellow-100 text-yellow-700" :
          "bg-gray-100 text-gray-600"
        }">
          ${s.status || "draft"}
        </span>
      </div>

      <div>
        <button onclick="event.stopPropagation(); openDoc('${s.id}')"
          class="text-blue-600 text-xs">
          View
        </button>
      </div>

    </div>
  `).join("");
}

// ================= SEARCH =================
search.addEventListener("input", () => {
  const q = search.value.toLowerCase();

  filtered = docs.filter(s =>
    JSON.stringify(s).toLowerCase().includes(q)
  );

  render();
});

// ================= OPEN DOC =================
window.openDoc = (id) => {
  currentDocId = id;
  const docData = docs.find(d => d.id === id);

  panel.classList.remove("hidden");
  editor.value = JSON.stringify(docData, null, 2);
};

// ================= SAVE =================
saveBtn.onclick = async () => {
  try {
    const data = JSON.parse(editor.value);
    delete data.id;

    const { error } = await supabase
      .from('services')
      .update({
        title: data.title,
        description: data.description,
        price: data.price,
        provider_name: data.providerName || data.provider_name,
        category: data.category,
        location: data.location,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentDocId);
    
    if (error) throw error;
    
    alert("Service updated");
  } catch (err) {
    alert("Invalid JSON: " + err.message);
  }
};

// ================= DELETE =================
deleteBtn.onclick = async () => {
  if (!confirm("Delete service?")) return;

  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', currentDocId);
    
    if (error) throw error;
    
    panel.classList.add("hidden");
    currentDocId = null;
    alert("Service deleted");
  } catch (err) {
    alert("Error deleting service: " + err.message);
  }
};

// ================= ADD =================
addBtn.onclick = async () => {
  try {
    const { data, error } = await supabase
      .from('services')
      .insert([{
        title: "New Service",
        description: "",
        price: 0,
        provider_name: "",
        category: "",
        location: "",
        created_at: new Date().toISOString(),
      }])
      .select();

    if (error) throw error;

    openDoc(data[0].id);
  } catch (err) {
    alert("Error creating service: " + err.message);
  }
};